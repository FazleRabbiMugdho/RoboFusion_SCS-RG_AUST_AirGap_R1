from backend.app.schemas.enums import HazardType, ZoneState
from backend.app.models.incident import Incident
from sqlalchemy.ext.asyncio import AsyncSession

HAZARD_WEIGHTS = {
    HazardType.FLAME: 0.45,
    HazardType.GAS: 0.3,
    HazardType.WATER: 0.2,
    HazardType.OCCUPANCY: 0.05,
}

STATE_BANDS = {
    ZoneState.SAFE: (0.0, 25.0),
    ZoneState.WARNING: (25.0, 50.0),
    ZoneState.CRITICAL: (50.0, 100.0),
}

STATE_CONFIRMATION_READINGS = 2


def compute_risk_score(
    flame_val: float,
    gas_val: float,
    water_val: float,
    occupancy_val: float,
) -> float:
    weighted_sum = (
        flame_val * HAZARD_WEIGHTS[HazardType.FLAME]
        + gas_val * HAZARD_WEIGHTS[HazardType.GAS]
        + water_val * HAZARD_WEIGHTS[HazardType.WATER]
        + occupancy_val * HAZARD_WEIGHTS[HazardType.OCCUPANCY]
    )
    max_sum = sum(HAZARD_WEIGHTS.values())
    score = (weighted_sum / max_sum) * 100.0
    if score < 0.0:
        return 0.0
    if score > 100.0:
        return 100.0
    return score


def classify_risk(score: float) -> ZoneState:
    if score >= STATE_BANDS[ZoneState.CRITICAL][0]:
        return ZoneState.CRITICAL
    if score >= STATE_BANDS[ZoneState.WARNING][0]:
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