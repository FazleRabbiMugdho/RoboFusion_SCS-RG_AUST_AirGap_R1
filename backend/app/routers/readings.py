from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.zone_auth import verify_zone_api_key
from backend.app.database import get_db
from backend.app.schemas.readings import ZoneIngestionPayload
from backend.app.services.ingestion_pipeline import ingest_zone_reading
from backend.app.services.seq import validate_and_advance_seq

router = APIRouter(tags=["ingestion"])


@router.post("/zones/{zone_id}/readings")
async def ingest_readings(
    zone_id: int,
    payload: ZoneIngestionPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_zone_api_key: str = Header(..., alias="X-Zone-Api-Key"),
):
    if zone_id != payload.zone_id:
        raise HTTPException(status_code=400, detail="Path zone_id does not match body zone_id")

    zone = await verify_zone_api_key(zone_id, x_zone_api_key, db)

    valid = await validate_and_advance_seq(db, zone_id, payload.seq_num)
    if not valid:
        raise HTTPException(status_code=409, detail="Duplicate or out-of-order sequence number")

    result = await ingest_zone_reading(db, zone, payload.seq_num, payload.readings)
    await db.commit()

    return {
        "zone_id": zone_id,
        "accepted_seq": zone.last_accepted_seq,
        "current_state": zone.current_state.value,
        "risk_score": round(result["risk_score"], 2),
    }