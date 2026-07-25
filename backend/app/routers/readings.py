import hmac
import hashlib
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.schemas.enums import HazardType, ZoneState
from backend.app.schemas.readings import ZoneIngestionPayload
from backend.app.models.zone import Zone
from backend.app.models.sensor import Sensor
from backend.app.models.reading import Reading
from backend.app.services.risk import compute_risk_score, classify_risk, update_zone_state, record_state_transition
from backend.app.services.seq import validate_and_advance_seq

router = APIRouter(tags=["ingestion"])


async def get_db() -> AsyncSession:  # placeholder — wired in Prompt 22
    raise NotImplementedError("DB session dependency not wired yet")


@router.post("/zones/{zone_id}/readings")
async def ingest_readings(
    zone_id: int,
    payload: ZoneIngestionPayload,
    x_zone_api_key: str = Header(..., alias="X-Zone-Api-Key"),
    db_session: AsyncSession = Depends(get_db),
):
    # Step 2: path zone_id vs body zone_id
    if zone_id != payload.zone_id:
        raise HTTPException(status_code=400, detail="Path zone_id does not match body zone_id")

    # Step 3-4: look up zone and validate API key
    result = await db_session.execute(
        select(Zone).where(Zone.id == zone_id)
    )
    zone = result.scalar_one_or_none()

    if zone is None:
        raise HTTPException(status_code=401, detail="Invalid zone or API key")

    salt = os.environ.get("ZONE_API_KEY_SALT", "").encode("utf-8")
    key_hash = hmac.new(salt, x_zone_api_key.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(key_hash, zone.api_key_hash):
        raise HTTPException(status_code=401, detail="Invalid zone or API key")

    # Step 5: validate seq_num
    valid = await validate_and_advance_seq(db_session, zone, payload.seq_num)
    if not valid:
        raise HTTPException(status_code=409, detail="Duplicate or out-of-order sequence number")

    # Step 6: lazy-create sensors and insert readings
    for reading_in in payload.readings:
        # Look up or create sensor row
        sensor_result = await db_session.execute(
            select(Sensor).where(
                Sensor.zone_id == zone_id,
                Sensor.hazard_type == reading_in.hazard_type,
            )
        )
        sensor = sensor_result.scalar_one_or_none()
        if sensor is None:
            sensor = Sensor(zone_id=zone_id, hazard_type=reading_in.hazard_type)
            db_session.add(sensor)
            await db_session.flush()

        # Insert reading row
        reading = Reading(
            sensor_id=sensor.id,
            seq_num=payload.seq_num,
            raw_value=reading_in.raw_value,
            normalized_value=reading_in.raw_value,
        )
        db_session.add(reading)

    # Step 7: compute risk score using last-known values for missing hazard types
    hazard_values = {}
    for ht in HazardType:
        if any(r.hazard_type == ht for r in payload.readings):
            r = next(r for r in payload.readings if r.hazard_type == ht)
            hazard_values[ht] = r.raw_value
        else:
            last = await db_session.execute(
                select(Reading.normalized_value)
                .join(Sensor, Reading.sensor_id == Sensor.id)
                .where(Sensor.zone_id == zone_id, Sensor.hazard_type == ht)
                .order_by(Reading.received_at.desc())
                .limit(1)
            )
            last_val = last.scalar()
            hazard_values[ht] = last_val if last_val is not None else 0.0

    risk_score = compute_risk_score(
        hazard_values[HazardType.FLAME],
        hazard_values[HazardType.GAS],
        hazard_values[HazardType.WATER],
        hazard_values[HazardType.OCCUPANCY],
    )

    # Determine new state band from risk score
    new_band = classify_risk(risk_score)

    # Apply state machine
    result_state, transitioned, old_state = update_zone_state(zone, new_band)

    # If transition happened, record it
    if transitioned:
        await record_state_transition(db_session, zone.id, result_state, risk_score)

    # Step 8: update last_seen_at
    zone.last_seen_at = datetime.now(timezone.utc)
    await db_session.flush()

    return {
        "zone_id": zone_id,
        "accepted_seq": zone.last_accepted_seq,
        "current_state": zone.current_state.value,
        "risk_score": round(risk_score, 2),
    }