import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.deps import require_role
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.zone import Zone
from backend.app.schemas.enums import Role
from backend.app.services.actuation_dispatch import dispatch_actuation_commands

ZONE_OFFLINE_THRESHOLD_SECONDS_BACKEND = 5

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin"])


class ActuationOverridePayload(BaseModel):
    buzzer: bool
    led: bool
    relay: bool


@router.get("/admin/zones/health")
async def get_zones_health(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role(Role.ADMIN))],
):
    result = await db.execute(select(Zone).order_by(Zone.id.asc()))
    zones = result.scalars().all()

    now = datetime.now(timezone.utc)
    health_list = []

    for z in zones:
        is_online = False
        if z.last_seen_at is not None:
            last_seen_tz = z.last_seen_at if z.last_seen_at.tzinfo else z.last_seen_at.replace(tzinfo=timezone.utc)
            delta = (now - last_seen_tz).total_seconds()
            is_online = delta < ZONE_OFFLINE_THRESHOLD_SECONDS_BACKEND

        health_list.append(
            {
                "id": z.id,
                "name": z.name,
                "lab_type": z.lab_type.value if hasattr(z.lab_type, "value") else str(z.lab_type),
                "current_state": z.current_state.value if hasattr(z.current_state, "value") else str(z.current_state),
                "ip_address": z.ip_address,
                "last_seen_at": z.last_seen_at.isoformat() if z.last_seen_at else None,
                "is_online": is_online,
            }
        )

    return {"zones": health_list}


@router.post("/admin/zones/{zone_id}/override")
async def override_zone_actuators(
    zone_id: int,
    payload: ActuationOverridePayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role(Role.ADMIN))],
):
    result = await db.execute(select(Zone).where(Zone.id == zone_id))
    zone = result.scalar_one_or_none()

    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    if not zone.ip_address:
        raise HTTPException(status_code=409, detail="zone has no registered ip_address")

    cmd = {
        "buzzer": payload.buzzer,
        "led": payload.led,
        "relay": payload.relay,
    }

    dispatch_res = await dispatch_actuation_commands([(zone.ip_address, cmd)])
    dispatched = dispatch_res.get(zone.ip_address, False)

    logger.info(
        "Admin override dispatch: user_id=%s, zone_id=%s, command=%s, dispatched=%s",
        current_user.id,
        zone_id,
        cmd,
        dispatched,
    )

    return {
        "zone_id": zone_id,
        "dispatched": dispatched,
    }
