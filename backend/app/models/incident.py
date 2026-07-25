from sqlalchemy import BigInteger, Column, DateTime, Double, ForeignKey, Index, Integer
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func

from backend.app.models.base import Base
from backend.app.schemas.enums import ZoneState


class Incident(Base):
    __tablename__ = "incidents"
    id = Column(BigInteger, primary_key=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    status = Column(SAEnum(ZoneState), nullable=False)
    risk_score = Column(Double, nullable=False)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_incidents_status_triggered_at", "status", "triggered_at"),
    )
