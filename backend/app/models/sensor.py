from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import Enum as SAEnum

from backend.app.models.base import Base
from backend.app.schemas.enums import HazardType


class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(Integer, primary_key=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    hazard_type = Column(SAEnum(HazardType, native_enum=False), nullable=False)
    __table_args__ = (UniqueConstraint("zone_id", "hazard_type"),)
