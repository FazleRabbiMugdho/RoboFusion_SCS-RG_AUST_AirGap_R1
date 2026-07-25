import os

import asyncpg
import pytest

from backend.app.schemas.enums import HazardType, LabType, Role, ZoneState

ENUM_MAP = {
    "hazard_type_enum": HazardType,
    "zone_state_enum": ZoneState,
    "zone_lab_enum": LabType,
    "role_enum": Role,
}

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:root@localhost:5432/robofusion",
)


@pytest.mark.asyncio
async def test_enum_labels_match_db():
    dsn = DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(dsn)
    try:
        for pg_enum_name, py_enum_cls in ENUM_MAP.items():
            rows = await conn.fetch(
                f"SELECT unnest(enum_range(NULL::{pg_enum_name}))::text AS label"
            )
            db_labels = {row["label"] for row in rows}
            py_labels = {m.value for m in py_enum_cls}
            assert db_labels == py_labels, (
                f"Mismatch for {pg_enum_name}: "
                f"DB={db_labels - py_labels}, Python={py_labels - db_labels}"
            )
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_zone_state_enum_values():
    """Verify ZoneState enum has correct values."""
    assert ZoneState.SAFE == "SAFE"
    assert ZoneState.WARNING == "WARNING"
    assert ZoneState.CRITICAL == "CRITICAL"


@pytest.mark.asyncio
async def test_hazard_type_enum_values():
    """Verify HazardType enum has correct values."""
    assert HazardType.FLAME == "FLAME"
    assert HazardType.GAS == "GAS"
    assert HazardType.WATER == "WATER"
    assert HazardType.OCCUPANCY == "OCCUPANCY"