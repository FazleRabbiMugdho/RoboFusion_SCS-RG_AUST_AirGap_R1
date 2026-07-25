from pydantic import BaseModel, Field, model_validator
from backend.app.schemas.enums import HazardType

class SensorReadingIn(BaseModel):
    hazard_type: HazardType
    raw_value: float
    seq_num: int = Field(gt=0)

class ZoneIngestionPayload(BaseModel):
    zone_id: int
    seq_num: int = Field(gt=0)
    readings: list[SensorReadingIn] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def check_unique_hazard_types(self):
        seen = set()
        for r in self.readings:
            if r.hazard_type in seen:
                raise ValueError(f"Duplicate hazard_type: {r.hazard_type}")
            seen.add(r.hazard_type)
        return self
