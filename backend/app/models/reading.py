from sqlalchemy import BigInteger, Column, DateTime, Double, ForeignKey, Index, Integer
from sqlalchemy.sql import func

from backend.app.models.base import Base


class Reading(Base):
    __tablename__ = "readings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False)
    seq_num = Column(BigInteger, nullable=False)
    raw_value = Column(Double, nullable=False)
    normalized_value = Column(Double, nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_readings_sensor_seq", "sensor_id", "seq_num"),
    )
