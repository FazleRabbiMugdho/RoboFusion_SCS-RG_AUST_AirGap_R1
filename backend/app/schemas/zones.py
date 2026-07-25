from datetime import datetime
from pydantic import BaseModel
from backend.app.schemas.enums import LabType, ZoneState

class ZoneOut(BaseModel):
    id: int
    name: str
    lab_type: LabType
    current_state: ZoneState
    last_seen_at: datetime | None
