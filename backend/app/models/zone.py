from sqlalchemy import Column, Integer, SmallInteger, String, BigInteger, DateTime, Enum as SAEnum, JSON
from sqlalchemy.sql import func
from backend.app.models.base import Base
from backend.app.schemas.enums import ZoneState, LabType

class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    lab_type = Column(SAEnum(LabType), nullable=False)
    api_key_hash = Column(String(255), nullable=False)
    current_state = Column(SAEnum(ZoneState), nullable=False, default=ZoneState.SAFE)
    pending_band = Column(SAEnum(ZoneState), nullable=True)
    pending_count = Column(SmallInteger, nullable=False, default=0)
    last_accepted_seq = Column(BigInteger, nullable=False, default=0)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    state_since = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_risk_breakdown = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
