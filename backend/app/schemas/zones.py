from datetime import datetime

from pydantic import BaseModel, ConfigDict

from backend.app.schemas.enums import LabType, ZoneState


class ZoneOut(BaseModel):
    id: int
    name: str
    lab_type: LabType
    current_state: ZoneState
    last_seen_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class RankedZoneOut(BaseModel):
    zone_id: int
    zone_name: str
    current_state: ZoneState
    risk_score: float
    occupied: bool
    seconds_in_state: float
    rank_reason: str
    risk_breakdown: dict
    latest_incident_id: int | None
    acknowledged: bool
    acknowledged_by_username: str | None

    model_config = ConfigDict(from_attributes=True)
