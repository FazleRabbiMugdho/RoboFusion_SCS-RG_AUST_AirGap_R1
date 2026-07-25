from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.incident import Incident
from backend.app.models.reading import Reading
from backend.app.models.sensor import Sensor
from backend.app.models.user import User
from backend.app.models.zone import Zone
from backend.app.schemas.enums import HazardType, ZoneState

OCCUPANCY_RECENCY_SECONDS = 10

SEVERITY_RANK = {
    ZoneState.CRITICAL: 2,
    ZoneState.WARNING: 1,
}


async def get_priority_ranking(db_session: AsyncSession) -> list[dict]:
    now = datetime.now(timezone.utc)

    result = await db_session.execute(
        select(Zone).where(Zone.current_state != ZoneState.SAFE)
    )
    zones = result.scalars().all()

    ranked = []
    for zone in zones:
        occupied = await _is_occupied(db_session, zone.id, now)

        seconds_in_state = (now - zone.state_since).total_seconds()

        risk_breakdown = zone.last_risk_breakdown or {}
        risk_score = risk_breakdown.get("total", 0.0)

        incident_result = await db_session.execute(
            select(Incident)
            .where(Incident.zone_id == zone.id)
            .order_by(Incident.triggered_at.desc())
            .limit(1)
        )
        incident = incident_result.scalar_one_or_none()

        latest_incident_id = incident.id if incident else None
        acknowledged = incident.acknowledged_at is not None if incident else False
        acknowledged_by_username = None
        if incident and incident.acknowledged_by is not None:
            user_result = await db_session.execute(
                select(User).where(User.id == incident.acknowledged_by)
            )
            user = user_result.scalar_one_or_none()
            acknowledged_by_username = user.username if user else None

        ranked.append({
            "zone_id": zone.id,
            "zone_name": zone.name,
            "current_state": zone.current_state,
            "risk_score": round(risk_score, 2),
            "occupied": occupied,
            "seconds_in_state": seconds_in_state,
            "rank_reason": _build_rank_reason(
                zone.current_state, risk_score, occupied, seconds_in_state,
            ),
            "risk_breakdown": risk_breakdown,
            "latest_incident_id": latest_incident_id,
            "acknowledged": acknowledged,
            "acknowledged_by_username": acknowledged_by_username,
        })

    ranked.sort(
        key=lambda z: (
            -SEVERITY_RANK[z["current_state"]],
            -z["risk_score"],
            -int(z["occupied"]),
            -z["seconds_in_state"],
        )
    )

    return ranked


async def _is_occupied(db_session: AsyncSession, zone_id: int, now: datetime) -> bool:
    sensor_result = await db_session.execute(
        select(Sensor.id).where(
            Sensor.zone_id == zone_id,
            Sensor.hazard_type == HazardType.OCCUPANCY,
        )
    )
    sensor_id = sensor_result.scalar_one_or_none()
    if sensor_id is None:
        return False

    cutoff = now - timedelta(seconds=OCCUPANCY_RECENCY_SECONDS)
    reading_result = await db_session.execute(
        select(Reading)
        .where(
            Reading.sensor_id == sensor_id,
            Reading.normalized_value >= 1.0,
            Reading.received_at >= cutoff,
        )
        .order_by(Reading.received_at.desc())
        .limit(1)
    )
    reading = reading_result.scalar_one_or_none()
    return reading is not None


def _build_rank_reason(
    state: ZoneState,
    risk_score: float,
    occupied: bool,
    seconds_in_state: float,
) -> str:
    parts = [f"{state.value}, risk {risk_score:.1f}"]
    if occupied:
        parts.append(", occupied")
    parts.append(f", in state for {seconds_in_state:.0f}s")
    return "".join(parts)
