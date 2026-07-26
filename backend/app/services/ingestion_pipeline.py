from datetime import datetime, timezone
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.reading import Reading
from backend.app.models.sensor import Sensor
from backend.app.schemas.enums import HazardType, ZoneState
from backend.app.schemas.readings import SensorReadingIn
from backend.app.services import remote_alert
from backend.app.services.actuation_dispatch import dispatch_actuation_commands
from backend.app.services.broadcast import manager as ws_manager
from backend.app.services.risk_fusion import (
    CAMERA_MOTION_THRESHOLD,
    CAMERA_STALENESS_SECONDS,
    classify_risk,
    compute_risk_breakdown,
    compute_risk_score,
    determine_zone_state,
    record_state_transition,
)


class IngestionResult(TypedDict):
    zone_state: ZoneState
    risk_score: float


def normalize_raw_value(raw: float) -> float:
    """Clamp raw sensor value to [0.0, 1.0] range."""
    if raw < 0.0:
        return 0.0
    if raw > 1.0:
        return 1.0
    return raw


async def get_last_normalized_value(
    db: AsyncSession,
    zone_id: int,
    hazard_type: HazardType,
) -> float:
    """Get the most recent normalized value for a hazard type in a zone."""
    result = await db.execute(
        select(Reading.normalized_value)
        .join(Sensor, Reading.sensor_id == Sensor.id)
        .where(Sensor.zone_id == zone_id, Sensor.hazard_type == hazard_type)
        .order_by(Reading.received_at.desc())
        .limit(1)
    )
    val = result.scalar()
    return val if val is not None else 0.0


async def ingest_zone_reading(
    db: AsyncSession,
    zone,
    seq_num: int,
    readings: list[SensorReadingIn],
) -> IngestionResult:
    """
    Core ingestion pipeline (steps 5-9 of Prompt 15).
    Reusable by both sensor ingestion and NL incident reporting.
    """
    # Step 6: lazy-create sensors and insert readings
    for reading_in in readings:
        sensor_result = await db.execute(
            select(Sensor).where(
                Sensor.zone_id == zone.id,
                Sensor.hazard_type == reading_in.hazard_type,
            )
        )
        sensor = sensor_result.scalar_one_or_none()
        if sensor is None:
            sensor = Sensor(zone_id=zone.id, hazard_type=reading_in.hazard_type)
            db.add(sensor)
            await db.flush()

        normalized = normalize_raw_value(reading_in.raw_value)
        reading = Reading(
            sensor_id=sensor.id,
            seq_num=seq_num,
            raw_value=reading_in.raw_value,
            normalized_value=normalized,
        )
        db.add(reading)

    # Step 7: compute risk score using last-known values for missing hazard types
    hazard_values = {}
    for ht in HazardType:
        if any(r.hazard_type == ht for r in readings):
            r = next(r for r in readings if r.hazard_type == ht)
            hazard_values[ht] = normalize_raw_value(r.raw_value)
        else:
            hazard_values[ht] = await get_last_normalized_value(db, zone.id, ht)

    occupied = hazard_values[HazardType.OCCUPANCY] >= 0.5

    # Camera motion cross-check: OR with PIR (either confirms occupancy)
    if not occupied:
        cam_score = zone.last_camera_motion_score
        cam_at = zone.last_camera_motion_at
        if (
            cam_score is not None
            and cam_at is not None
            and cam_score > CAMERA_MOTION_THRESHOLD
            and (datetime.now(timezone.utc) - cam_at).total_seconds() < CAMERA_STALENESS_SECONDS
        ):
            occupied = True

    risk_score = compute_risk_score(
        hazard_values[HazardType.FLAME],
        hazard_values[HazardType.GAS],
        hazard_values[HazardType.WATER],
        occupied,
    )

    risk_breakdown = compute_risk_breakdown(
        hazard_values[HazardType.FLAME],
        hazard_values[HazardType.GAS],
        hazard_values[HazardType.WATER],
        occupied,
    )

    new_band = classify_risk(risk_score)

    old_state = zone.current_state
    result_state, new_pending_band, new_pending_count = determine_zone_state(zone, new_band)
    transitioned = (result_state != old_state)

    if transitioned:
        zone.current_state = result_state
        zone.pending_band = new_pending_band
        zone.pending_count = new_pending_count
        await record_state_transition(db, zone, result_state, risk_score, risk_breakdown)

        if result_state == ZoneState.CRITICAL:
            contributions = {
                "fire_contribution": risk_breakdown.get("fire_contribution", 0.0),
                "gas_contribution": risk_breakdown.get("gas_contribution", 0.0),
                "water_contribution": risk_breakdown.get("water_contribution", 0.0),
            }
            max_key = max(contributions, key=contributions.get)
            hazard_map = {
                "fire_contribution": HazardType.FLAME,
                "gas_contribution": HazardType.GAS,
                "water_contribution": HazardType.WATER,
            }
            primary_hazard_type = (
                hazard_map[max_key].value
                if contributions[max_key] > 0
                else None
            )

            import asyncio
            asyncio.create_task(
                remote_alert.send_remote_alert(
                    zone_name=zone.name,
                    risk_score=risk_score,
                    primary_hazard_type=primary_hazard_type,
                    triggered_at=datetime.now(timezone.utc),
                )
            )

            command = {"buzzer": True, "led": True, "relay": True}
            targets = [(zone.ip_address, command)]
        elif old_state == ZoneState.CRITICAL and result_state != ZoneState.CRITICAL:
            command = {"buzzer": False, "led": False, "relay": False}
            targets = [(zone.ip_address, command)]
        else:
            targets = None

        if targets:
            await dispatch_actuation_commands(targets)

    await ws_manager.broadcast(
        zone_id=zone.id,
        zone_name=zone.name,
        current_state=result_state,
        previous_state=old_state,
        risk_score=risk_score,
        risk_breakdown=risk_breakdown,
    )

    zone.last_risk_breakdown = risk_breakdown
    zone.last_seen_at = datetime.now(timezone.utc)
    await db.flush()

    return {"zone_state": result_state, "risk_score": risk_score}