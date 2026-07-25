from datetime import datetime
from pydantic import BaseModel
from backend.app.schemas.enums import ZoneState

class IncidentOut(BaseModel):
    id: int
    zone_id: int
    status: ZoneState
    risk_score: float
    triggered_at: datetime
    acknowledged_by: int | None
    acknowledged_at: datetime | None
    resolved_at: datetime | None
