import base64
from datetime import date, datetime, time, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from backend.app.core.deps import get_current_user
from backend.app.database import get_db
from backend.app.models.incident import Incident
from backend.app.models.user import User
from backend.app.models.zone import Zone
from backend.app.schemas.enums import HazardType, ZoneState

router = APIRouter(tags=["incidents"])


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
