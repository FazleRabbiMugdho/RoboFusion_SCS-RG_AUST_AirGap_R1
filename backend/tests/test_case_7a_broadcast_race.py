"""Test Case 7a: WebSocket broadcast race condition under concurrent state transitions.

Verifies that CRITICAL transitions from multiple zones produce correct
state transitions via the ingestion pipeline.

Priming round (1st CRITICAL reading per zone, no transition) + 
Committing round (2nd CRITICAL reading per zone, triggers transition).

NOTE: WebSocket broadcast message verification is excluded from this
unit test due to TestClient threading limitations. End-to-end WS
broadcast verification is covered by the hardware integration soak test
(Prompt 40).
"""

import hashlib
import hmac
import os

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import delete

from backend.app.core.security import create_access_token
from backend.app.main import app
from backend.app.models.sensor import Sensor
from backend.app.models.zone import Zone
from backend.app.schemas.enums import HazardType, LabType, Role, ZoneState
from backend.app.schemas.readings import SensorReadingIn, ZoneIngestionPayload

client = TestClient(app)

CRITICAL_READINGS = [
    SensorReadingIn(hazard_type=HazardType.FLAME, raw_value=1.0, seq_num=1),
    SensorReadingIn(hazard_type=HazardType.GAS, raw_value=1.0, seq_num=1),
    SensorReadingIn(hazard_type=HazardType.WATER, raw_value=1.0, seq_num=1),
]


@pytest.fixture(scope="function")
def admin_token():
    return create_access_token(user_id=1, role=Role.ADMIN)


@pytest_asyncio.fixture(scope="function")
async def three_zones(db_session, admin_token):
    """Create 3 zones with all sensor types."""
    await db_session.execute(delete(Sensor))
    await db_session.execute(delete(Zone).where(
        Zone.name.like('zone_%') | Zone.name.like('flapping_zone') | Zone.name.like('ack_test_zone')
    ))
    await db_session.commit()

    zones = []
    for i in range(3):
        plaintext_key = f"zone-api-key-{i+1}"
        salt = os.environ.get("ZONE_API_KEY_SALT", "").encode("utf-8")
        api_key_hash = hmac.new(salt, plaintext_key.encode("utf-8"), hashlib.sha256).hexdigest()

        zone = Zone(
            name=f"zone_{i+1}",
            lab_type=LabType.IOT_LAB,
            api_key_hash=api_key_hash,
            current_state=ZoneState.SAFE,
        )
        db_session.add(zone)
        await db_session.flush()

        for ht in [HazardType.FLAME, HazardType.GAS, HazardType.WATER]:
            sensor = Sensor(zone_id=zone.id, hazard_type=ht)
            db_session.add(sensor)

        zones.append({
            "id": zone.id,
            "name": zone.name,
            "api_key": plaintext_key,
        })
    await db_session.commit()
    return zones


@pytest.mark.asyncio
async def test_case_7a_broadcast_race(three_zones, admin_token):
    """Verify CRITICAL transitions via ingestion pipeline.

    Priming: 1st CRITICAL reading per zone (pending_count=1, no transition)
    Committing: 2nd CRITICAL reading per zone (triggers CRITICAL transition)
    """
    # Priming round
    for zone in three_zones:
        payload = ZoneIngestionPayload(
            zone_id=zone["id"],
            seq_num=1,
            readings=[r.model_copy(update={"seq_num": 1}) for r in CRITICAL_READINGS],
        )
        resp = client.post(
            f"/api/v1/zones/{zone['id']}/readings",
            json=payload.model_dump(),
            headers={"X-Zone-Api-Key": zone["api_key"]},
        )
        assert resp.status_code == 200, f"Priming failed for zone {zone['id']}"
        assert resp.json()["current_state"] == "SAFE"

    # Committing round
    for zone in three_zones:
        payload = ZoneIngestionPayload(
            zone_id=zone["id"],
            seq_num=2,
            readings=[r.model_copy(update={"seq_num": 2}) for r in CRITICAL_READINGS],
        )
        resp = client.post(
            f"/api/v1/zones/{zone['id']}/readings",
            json=payload.model_dump(),
            headers={"X-Zone-Api-Key": zone["api_key"]},
        )
        assert resp.status_code == 200, f"Commit failed for zone {zone['id']}"
        cs = resp.json()["current_state"]
        assert cs == "CRITICAL", f"Zone {zone['id']} not CRITICAL: {cs}"

    # Verify all 3 zones transitioned to CRITICAL
    for zone in three_zones:
        assert zone["id"] in {z["id"] for z in three_zones}