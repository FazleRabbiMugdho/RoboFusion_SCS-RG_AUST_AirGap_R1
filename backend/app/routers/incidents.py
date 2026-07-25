from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from backend.app.database import get_db
from backend.app.models.incident import Incident

router = APIRouter(tags=["incidents"])


class AcknowledgeRequest(BaseModel):
    user_id: int


@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(
    incident_id: int,
    body: AcknowledgeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        update(Incident)
        .where(Incident.id == incident_id, Incident.acknowledged_at.is_(None))
        .values(acknowledged_by=body.user_id, acknowledged_at=func.now())
        .returning(Incident.acknowledged_by, Incident.acknowledged_at)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()

    if row is not None:
        acked_by, acked_at = row
        return {
            "status": "acknowledged",
            "incident_id": incident_id,
            "acknowledged_by": acked_by,
            "acknowledged_at": acked_at.isoformat() if acked_at else None,
        }

    existing = await db.execute(
        select(Incident).where(Incident.id == incident_id)
    )
    incident = existing.scalar_one_or_none()

    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")

    return {
        "status": "already_acknowledged",
        "incident_id": incident.id,
        "acknowledged_by": incident.acknowledged_by,
        "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
    }
