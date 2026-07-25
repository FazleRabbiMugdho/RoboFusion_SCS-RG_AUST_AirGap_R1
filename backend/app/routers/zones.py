from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.zone import Zone
from backend.app.schemas.zones import ZoneOut
from backend.app.services.priority_ranking import get_priority_ranking

router = APIRouter(tags=["zones"])


@router.get("/zones")
async def list_zones(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Zone).order_by(Zone.id))
    zones = result.scalars().all()
    return {"zones": [ZoneOut.model_validate(z) for z in zones]}


@router.get("/zones/priority-ranking")
async def priority_ranking(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ranked = await get_priority_ranking(db)
    return {"ranked_zones": ranked}
