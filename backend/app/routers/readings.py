import hashlib
import hmac
import os
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.reading import Reading
from backend.app.models.sensor import Sensor
from backend.app.models.zone import Zone
from backend.app.schemas.enums import HazardType, ZoneState
from backend.app.schemas.readings import ZoneIngestionPayload
from backend.app.services.actuation_dispatch import dispatch_actuation_commands
from backend.app.services.broadcast import manager as ws_manager
from backend.app.services.risk_fusion import (
    classify_risk,
    compute_risk_breakdown,
    compute_risk_score,
    determine_zone_state,
    record_state_transition,
)
from backend.app.services.seq import validate_and_advance_seq

router = APIRouter(tags=["ingestion"])


def normalize_raw_value(raw: float) -> float:
    """Clamp raw sensor value to [0.0, 1.0] range."""
    if raw < 0.0:
        return 0.0
    if raw > 1.0:
        return 1.0
    return raw


@router.post("/zones/{zone_id}/readings")
async def ingest_readings(
    zone_id: int,
    payload: ZoneIngestionPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_zone_api_key: str = Header(..., alias="X-Zone-Api-Key"),
):
    # Step 2: path zone_id vs body zone_id
    if zone_id != payload.zone_id:
        raise HTTPException(status_code=400, detail="Path zone_id does not match body zone_id")

    # Step 3-4: look up zone and validate API key
    result = await db.execute(
        select(Zone).where(Zone.id == zone_id)
    )
    zone = result.scalar_one_or_none()

    if zone is None:
        raise HTTPException(status_code=401, detail="Invalid zone or API key")

    salt = os.environ.get("ZONE_API_KEY_SALT", "").encode("utf-8")
    key_hash = hmac.new(salt, x_zone_api_key.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(key_hash, zone.api_key_hash):
        raise HTTPException(status_code=401, detail="Invalid zone or API key")

    # Step 5: validate seq_num (with row lock inside)
    valid = await validate_and_advance_seq(db, zone_id, payload.seq_num)
    if not valid:
        raise HTTPException(status_code=409, detail="Duplicate or out-of-order sequence number")

    # Step 6: lazy-create sensors and insert readings
    for reading_in in payload.readings:
        # Look up or create sensor row
        sensor_result = await db.execute(
            select(Sensor).where(
                Sensor.zone_id == zone_id,
                Sensor.hazard_type == reading_in.hazard_type,
            )
        )
        sensor = sensor_result.scalar_one_or_none()
        if sensor is None:
            sensor = Sensor(zone_id=zone_id, hazard_type=reading_in.hazard_type)
            db.add(sensor)
            await db.flush()

        # Insert reading row with normalized value
        normalized = normalize_raw_value(reading_in.raw_value)
        reading = Reading(
            sensor_id=sensor.id,
            seq_num=payload.seq_num,
            raw_value=reading_in.raw_value,
            normalized_value=normalized,
        )
        db.add(reading)

    # Step 7: compute risk score using last-known values for missing hazard types
    hazard_values = {}
    for ht in HazardType:
        if any(r.hazard_type == ht for r in payload.readings):
            r = next(r for r in payload.readings if r.hazard_type == ht)
            hazard_values[ht] = normalize_raw_value(r.raw_value)
        else:
            last = await db.execute(
                select(Reading.normalized_value)
                .join(Sensor, Reading.sensor_id == Sensor.id)
                .where(Sensor.zone_id == zone_id, Sensor.hazard_type == ht)
                .order_by(Reading.received_at.desc())
                .limit(1)
            )
            last_val = last.scalar()
            hazard_values[ht] = last_val if last_val is not None else 0.0

    occupied = hazard_values[HazardType.OCCUPANCY] >= 0.5

    risk_score = compute_risk_score(
        hazard_values[HazardType.FLAME],
        hazard_values[HazardType.GAS],
        hazard_values[HazardType.WATER],
        occupied,
    )

    # Compute risk breakdown for broadcast and storage
    risk_breakdown = compute_risk_breakdown(
        hazard_values[HazardType.FLAME],
        hazard_values[HazardType.GAS],
        hazard_values[HazardType.WATER],
        occupied,
    )

    # Determine new state band from risk score
    new_band = classify_risk(risk_score)

    # Apply state machine
    old_state = zone.current_state
    result_state, new_pending_band, new_pending_count = determine_zone_state(zone, new_band)
    transitioned = (result_state != old_state)

    if transitioned:
        zone.current_state = result_state
        zone.pending_band = new_pending_band
        zone.pending_count = new_pending_count
        await record_state_transition(db, zone, result_state, risk_score, risk_breakdown)

        if result_state == ZoneState.CRITICAL:
            command = {"buzzer": True, "led": True, "relay": True}
            targets = [(zone.ip_address, command)]
        elif old_state == ZoneState.CRITICAL and result_state != ZoneState.CRITICAL:
            command = {"buzzer": False, "led": False, "relay": False}
            targets = [(zone.ip_address, command)]
        else:
            targets = None

        if targets:
            await dispatch_actuation_commands(targets)

    # Broadcast to dashboard after every successful ingestion
    await ws_manager.broadcast(
        zone_id=zone.id,
        zone_name=zone.name,
        current_state=result_state,
        previous_state=old_state,
        risk_score=risk_score,
        risk_breakdown=risk_breakdown,
    )

    # Update last_risk_breakdown on every accepted reading
    zone.last_risk_breakdown = risk_breakdown

    # Step 8: update last_seen_at
    zone.last_seen_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "zone_id": zone_id,
        "accepted_seq": zone.last_accepted_seq,
        "current_state": zone.current_state.value,
        "risk_score": round(risk_score, 2),
    }