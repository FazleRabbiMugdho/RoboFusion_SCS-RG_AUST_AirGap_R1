from datetime import datetime
from pydantic import BaseModel
from backend.app.schemas.enums import ZoneState


class ZoneStateUpdate(BaseModel):
    """WebSocket message shape for zone-state broadcasts.

    Consumed by the Dashboard, Incident History, and Micro-interaction
    prompts — any change here must be reflected in ws-messages.ts and
    those downstream prompts.
    """
    type: str = "zone_state_update"
    zone_id: int
    zone_name: str
    current_state: ZoneState
    previous_state: ZoneState
    risk_score: float
    triggered_at: datetime
    connection_count: int