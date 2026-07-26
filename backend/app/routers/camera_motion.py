import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.zone_auth import verify_zone_api_key
from backend.app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["camera-motion"])


class CameraMotionPayload(BaseModel):
    motion_score: float = Field(ge=0.0, le=1.0)
    seq_num: int = Field(gt=0)


@router.post("/zones/{zone_id}/camera-motion")
async def ingest_camera_motion(
    zone_id: int,
    payload: CameraMotionPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_zone_api_key: str = Header(..., alias="X-Zone-Api-Key"),
):
    zone = await verify_zone_api_key(zone_id, x_zone_api_key, db)

    # Independent sequence guard for camera motion stream
    if payload.seq_num <= zone.last_camera_seq:
        logger.warning(
            "camera_motion_rejected zone=%d seq=%d stored_seq=%d",
            zone_id,
            payload.seq_num,
            zone.last_camera_seq,
        )
        raise HTTPException(
            status_code=409,
            detail="duplicate or out-of-order camera sequence number",
        )

    zone.last_camera_motion_score = payload.motion_score
    zone.last_camera_motion_at = datetime.now(timezone.utc)
    zone.last_camera_seq = payload.seq_num

    await db.flush()

    logger.info(
        "camera_motion_accepted zone=%d seq=%d score=%.4f",
        zone_id,
        payload.seq_num,
        payload.motion_score,
    )

    return {"status": "accepted"}