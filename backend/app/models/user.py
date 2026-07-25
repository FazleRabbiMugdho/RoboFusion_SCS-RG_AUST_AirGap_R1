from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
from backend.app.models.base import Base
from backend.app.schemas.enums import Role

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(Role), nullable=False, default=Role.STAFF)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
