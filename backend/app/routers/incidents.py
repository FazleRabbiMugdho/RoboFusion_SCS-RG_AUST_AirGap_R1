import base64
import json
import logging
import os
from datetime import date, datetime, time, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from backend.app.core.deps import get_current_user
from backend.app.database import get_db
from backend.app.models.incident import Incident
from backend.app.models.user import User
from backend.app.models.zone import Zone
from backend.app.schemas.enums import HazardType, ZoneState
from backend.app.schemas.readings import SensorReadingIn
from backend.app.services.ingestion_pipeline import ingest_zone_reading
from backend.app.services.nl_parser import NL_CONFIDENCE_FLOOR, parse_incident_text
from backend.app.services.nl_stub import parse_incident_text_stub

router = APIRouter(tags=["incidents"])
logger = logging.getLogger(__name__)


@router.get("/incidents")
async def list_incidents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    zone_id: Annotated[int | None, Query()] = None,
    hazard_type: Annotated[HazardType | None, Query()] = None,
    status: Annotated[ZoneState | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    sort: Annotated[Literal["triggered_at_desc", "triggered_at_asc"], Query()] = "triggered_at_desc",
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    # Validation check for date range
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be <= date_to")

    stmt = (
        select(Incident, Zone.name.label("zone_name"), User.username.label("acknowledged_by_username"))
        .join(Zone, Incident.zone_id == Zone.id)
        .outerjoin(User, Incident.acknowledged_by == User.id)
    )

    # Filter conditions
    if zone_id is not None:
        stmt = stmt.where(Incident.zone_id == zone_id)
    if hazard_type is not None:
        stmt = stmt.where(Incident.primary_hazard_type == hazard_type)
    if status is not None:
        stmt = stmt.where(Incident.status == status)
    if date_from is not None:
        dt_from = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        stmt = stmt.where(Incident.triggered_at >= dt_from)
    if date_to is not None:
        dt_to = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
        stmt = stmt.where(Incident.triggered_at <= dt_to)

    # Keyset Cursor Pagination
    if cursor:
        try:
            decoded = base64.b64decode(cursor.encode("utf-8")).decode("utf-8")
            iso_str, id_str = decoded.rsplit("|", 1)
            cursor_dt = datetime.fromisoformat(iso_str)
            cursor_id = int(id_str)

            if sort == "triggered_at_desc":
                stmt = stmt.where(
                    (Incident.triggered_at < cursor_dt)
                    | ((Incident.triggered_at == cursor_dt) & (Incident.id < cursor_id))
                )
            else:
                stmt = stmt.where(
                    (Incident.triggered_at > cursor_dt)
                    | ((Incident.triggered_at == cursor_dt) & (Incident.id > cursor_id))
                )
        except Exception as err:
            raise HTTPException(status_code=400, detail="Invalid cursor format") from err

    # Sorting
    if sort == "triggered_at_desc":
        stmt = stmt.order_by(Incident.triggered_at.desc(), Incident.id.desc())
    else:
        stmt = stmt.order_by(Incident.triggered_at.asc(), Incident.id.asc())

    stmt = stmt.limit(limit + 1)
    results = (await db.execute(stmt)).all()

    has_more = len(results) > limit
    rows = results[:limit]

    next_cursor = None
    if has_more and rows:
        last_incident = rows[-1][0]
        cursor_payload = f"{last_incident.triggered_at.isoformat()}|{last_incident.id}"
        next_cursor = base64.b64encode(cursor_payload.encode("utf-8")).decode("utf-8")

    now = datetime.now(timezone.utc)
    incidents_out = []
    for inc, zone_name, ack_username in rows:
        end_time = inc.resolved_at or now
        duration_sec = max(0, int((end_time - inc.triggered_at).total_seconds()))

        incidents_out.append(
            {
                "id": inc.id,
                "zone_id": inc.zone_id,
                "zone_name": zone_name,
                "status": inc.status.value,
                "primary_hazard_type": inc.primary_hazard_type.value if inc.primary_hazard_type else None,
                "risk_score": round(inc.risk_score, 2),
                "triggered_at": inc.triggered_at.isoformat(),
                "acknowledged_by_username": ack_username,
                "acknowledged_at": inc.acknowledged_at.isoformat() if inc.acknowledged_at else None,
                "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
                "duration_seconds": duration_sec,
            }
        )

    return {
        "incidents": incidents_out,
        "next_cursor": next_cursor,
    }


@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(
    incident_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Use UPDATE with RETURNING for atomic check-and-set
    stmt = (
        update(Incident)
        .where(Incident.id == incident_id, Incident.acknowledged_at.is_(None))
        .values(acknowledged_by=current_user.id, acknowledged_at=func.now())
        .returning(Incident.acknowledged_by, Incident.acknowledged_at)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()

    if row is not None:
        acked_by, acked_at = row
        await db.commit()
        return {
            "status": "acknowledged",
            "incident_id": incident_id,
            "acknowledged_by": acked_by,
            "acknowledged_at": acked_at.isoformat() if acked_at else None,
        }

    existing = await db.execute(
        select(Incident).where(Incident.id == incident_id)
    )
    incident = existing.scalar_one_or_none()

    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")

    return {
        "status": "already_acknowledged",
        "incident_id": incident.id,
        "acknowledged_by": incident.acknowledged_by,
        "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
    }


class NLReportIn(BaseModel):
    free_text: str = Field(max_length=500)


class NLReportOut(BaseModel):
    status: Literal["accepted"]
    zone_id: int
    zone_name: str
    hazard_type: HazardType
    severity: float
    zone_state: ZoneState
    risk_score: float


@router.post("/incidents/report-nl", response_model=NLReportOut)
async def report_nl_incident(
    payload: NLReportIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    free_text = payload.free_text.strip()
    if not free_text:
        raise HTTPException(
            status_code=422,
            detail="couldn't confidently parse that report — please use the standard incident form",
        )

    use_stub = os.environ.get("USE_LOCAL_STUB", "false").lower() == "true"

    try:
        if use_stub:
            parsed = parse_incident_text_stub(free_text)
            parser_source = "stub"
        else:
            parsed = await parse_incident_text(free_text)
            parser_source = "gemini"
    except (json.JSONDecodeError, ValueError, KeyError, AttributeError) as e:
        logger.warning("NL parse failed for user_id=%s text=%r exc=%s",
                       current_user.id, free_text[:200], e)
        if not use_stub:
            raise HTTPException(
                status_code=503,
                detail="NL reporting is temporarily unavailable — please use the standard incident form",
            )
        parsed = parse_incident_text_stub(free_text)
        parser_source = "stub_fallback"

    logger.info("NL report user_id=%s parser=%s text=%r parsed=%s",
                current_user.id, parser_source, free_text[:200], parsed)

    if parsed is None:
        raise HTTPException(
            status_code=422,
            detail="couldn't confidently parse that report — please use the standard incident form",
        )

    if parsed["confidence"] < NL_CONFIDENCE_FLOOR:
        logger.info("NL confidence too low: %.2f < %.2f", parsed["confidence"], NL_CONFIDENCE_FLOOR)
        raise HTTPException(
            status_code=422,
            detail="couldn't confidently parse that report — please use the standard incident form",
        )

    # Look up zone by name
    zone_result = await db.execute(select(Zone).where(Zone.name == parsed["zone_name"]))
    zone = zone_result.scalar_one_or_none()
    if zone is None:
        logger.warning("NL zone not found: %s", parsed["zone_name"])
        raise HTTPException(
            status_code=422,
            detail="couldn't confidently parse that report — please use the standard incident form",
        )

    # Get next seq_num under row lock
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(Zone)
        .where(Zone.id == zone.id)
        .with_for_update()
    )
    locked_zone = result.scalar_one()
    next_seq = locked_zone.last_accepted_seq + 1
    locked_zone.last_accepted_seq = next_seq
    await db.flush()

    # Build a single SensorReadingIn for the extracted hazard type
    reading = SensorReadingIn(
        hazard_type=parsed["hazard_type"],
        raw_value=parsed["severity"],
        seq_num=next_seq,
    )

    result = await ingest_zone_reading(db, zone, next_seq, [reading])

    return NLReportOut(
        status="accepted",
        zone_id=zone.id,
        zone_name=zone.name,
        hazard_type=parsed["hazard_type"],
        severity=parsed["severity"],
        zone_state=result["zone_state"],
        risk_score=result["risk_score"],
    )
