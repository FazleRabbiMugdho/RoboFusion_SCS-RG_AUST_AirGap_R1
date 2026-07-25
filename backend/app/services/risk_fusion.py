from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.incident import Incident
from backend.app.schemas.enums import HazardType, ZoneState

HAZARD_WEIGHTS = {
    HazardType.FLAME: 0.45,
    HazardType.GAS: 0.35,
    HazardType.WATER: 0.20,
}

OCCUPANCY_MULTIPLIER = 1.15

STATE_THRESHOLDS = {
    ZoneState.SAFE: 40.0,
    ZoneState.WARNING: 70.0,
    ZoneState.CRITICAL: 100.0,
}

STATE_CONFIRMATION_READINGS = 2


def compute_risk_score(
    flame_norm: float,
    gas_norm: float,
    water_norm: float,
    occupied: bool,
) -> float:
    weighted_sum = (
        flame_norm * HAZARD_WEIGHTS[HazardType.FLAME]
        + gas_norm * HAZARD_WEIGHTS[HazardType.GAS]
        + water_norm * HAZARD_WEIGHTS[HazardType.WATER]
    )
    score = weighted_sum * 100.0
    if occupied:
        score *= OCCUPANCY_MULTIPLIER
    if score < 0.0:
        return 0.0
    if score > 100.0:
        return 100.0
    return score


def compute_risk_breakdown(
    flame_norm: float,
    gas_norm: float,
    water_norm: float,
    occupied: bool,
) -> dict:
    fire_contribution = flame_norm * HAZARD_WEIGHTS[HazardType.FLAME] * 100.0
    gas_contribution = gas_norm * HAZARD_WEIGHTS[HazardType.GAS] * 100.0
    water_contribution = water_norm * HAZARD_WEIGHTS[HazardType.WATER] * 100.0

    base_total = fire_contribution + gas_contribution + water_contribution
    occupancy_multiplier_applied = OCCUPANCY_MULTIPLIER if occupied else 1.0
    total = base_total * occupancy_multiplier_applied
    total = min(total, 100.0)

    return {
        "fire_contribution": round(fire_contribution, 2),
        "gas_contribution": round(gas_contribution, 2),
        "water_contribution": round(water_contribution, 2),
        "occupancy_multiplier_applied": occupancy_multiplier_applied,
        "total": round(total, 2),
    }


def classify_risk(score: float) -> ZoneState:
    if score >= STATE_THRESHOLDS[ZoneState.CRITICAL]:
        return ZoneState.CRITICAL
    if score >= STATE_THRESHOLDS[ZoneState.WARNING]:
        return ZoneState.WARNING
    return ZoneState.SAFE


def determine_zone_state(
    zone,
    reading_band: ZoneState,
) -> tuple[ZoneState, ZoneState | None, int]:
    """
    Pure state-machine step. Returns (new_current_state, new_pending_band, new_pending_count).
    Caller must wrap in a DB transaction and call record_state_transition
    if transitioned is True.
    """
    if zone.pending_band == reading_band:
        zone.pending_count += 1
    else:
        zone.pending_band = reading_band
        zone.pending_count = 1

    if zone.pending_count >= STATE_CONFIRMATION_READINGS and reading_band != zone.current_state:
        zone.current_state = reading_band
        zone.pending_band = None
        zone.pending_count = 0
        return reading_band, None, 0

    return zone.current_state, zone.pending_band, zone.pending_count


async def record_state_transition(
    db_session: AsyncSession,
    zone,
    new_state: ZoneState,
    risk_score: float,
) -> None:
    incident = Incident(
        zone_id=zone.id,
        status=new_state,
        risk_score=risk_score,
    )
    db_session.add(incident)
    zone.state_since = datetime.now(timezone.utc)
    await db_session.flush()