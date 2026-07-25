from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.services.priority_ranking import get_priority_ranking

router = APIRouter(tags=["zones"])


@router.get("/zones/priority-ranking")
async def priority_ranking(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ranked = await get_priority_ranking(db)
    return {"ranked_zones": ranked}
