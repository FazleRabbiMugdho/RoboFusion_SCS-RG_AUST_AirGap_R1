from backend.app.schemas.enums import HazardType, ZoneState
from backend.app.models.incident import Incident
from sqlalchemy.ext.asyncio import AsyncSession

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
    if total > 100.0:
        total = 100.0

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


def should_transition(
    current_state: ZoneState,
    pending_band: ZoneState,
    pending_count: int,
    threshold: int = STATE_CONFIRMATION_READINGS,
) -> bool:
    if pending_band != current_state and pending_count >= threshold:
        return True
    return False


async def record_state_transition(
    db_session: AsyncSession,
    zone_id: int,
    new_state: ZoneState,
    risk_score: float,
) -> None:
    incident = Incident(
        zone_id=zone_id,
        status=new_state,
        risk_score=risk_score,
    )
    db_session.add(incident)
    await db_session.flush()


def compute_risk_breakdown(
    flame_norm: float,
    gas_norm: float,
    water_norm: float,
    occupied: bool,
) -> dict:
    fire_contribution = flame_norm * HAZARD_WEIGHTS[HazardType.FLAME] * 100.0
    gas_contribution = gas_norm * HAZARD_WEIGHTS[HazardType.GAS] * 100.0
    water_contribution = water_norm * HAZARD_WEIGHTS[HazardType.WATER] * 100.0
    occupancy_multiplier = 1.15 if occupied else 1.0
    total = (fire_contribution + gas_contribution + water_contribution) * occupancy_multiplier
    total = max(0.0, min(100.0, total))
    return {
        "fire_contribution": round(fire_contribution, 2),
        "gas_contribution": round(gas_contribution, 2),
        "water_contribution": round(water_contribution, 2),
        "occupancy_multiplier_applied": occupancy_multiplier,
        "total": round(total, 2),
    }


def update_zone_state(zone, reading_band: ZoneState):
    """
    Pure state-machine step. Returns (new_current_state, transitioned, old_state).
    Caller must wrap in a DB transaction and call record_state_transition
    if transitioned is True.
    """
    if zone.pending_band == reading_band:
        zone.pending_count += 1
    else:
        zone.pending_band = reading_band
        zone.pending_count = 1

    if zone.pending_count >= STATE_CONFIRMATION_READINGS and reading_band != zone.current_state:
        old_state = zone.current_state
        zone.current_state = reading_band
        zone.pending_band = None
        zone.pending_count = 0
        return reading_band, True, old_state

    return zone.current_state, False, zone.current_state