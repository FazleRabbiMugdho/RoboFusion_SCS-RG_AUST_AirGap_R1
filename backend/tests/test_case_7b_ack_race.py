"""Test Case 7b: Acknowledgment Race Condition

Verifies that POST /incidents/{id}/acknowledge for an already-acknowledged
incident returns status="already_acknowledged" with identical
acknowledged_by/acknowledged_at values.

Uses the UPDATE with WHERE + RETURNING pattern for atomic check-and-set.
"""
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import delete

from backend.app.core.security import create_access_token
from backend.app.main import app
from backend.app.models.incident import Incident
from backend.app.models.sensor import Sensor
from backend.app.models.zone import Zone
from backend.app.schemas.enums import HazardType, LabType, Role, ZoneState

client = TestClient(app)


@pytest.fixture
def admin_token():
    return create_access_token(user_id=1, role=Role.ADMIN)


@pytest_asyncio.fixture
async def incident_for_ack(db_session):
    """Create an unacknowledged incident for testing."""
    await db_session.execute(delete(Sensor))
    await db_session.execute(delete(Incident))
    await db_session.execute(delete(Zone).where(Zone.name.like('ack_test_zone') | Zone.name.like('zone_%') | Zone.name.like('flapping_zone')))
    await db_session.commit()

    zone = Zone(
        name="ack_test_zone",
        lab_type=LabType.IOT_LAB,
        api_key_hash="dummy",
        current_state=ZoneState.CRITICAL,
    )
    db_session.add(zone)
    await db_session.flush()

    incident = Incident(
        zone_id=zone.id,
        status=ZoneState.CRITICAL,
        primary_hazard_type=HazardType.FLAME,
        risk_score=95.0,
        acknowledged_by=None,
        acknowledged_at=None,
    )
    db_session.add(incident)
    await db_session.commit()
    await db_session.refresh(incident)
    return incident.id


@pytest.mark.asyncio
async def test_case_7b_ack_race(incident_for_ack, admin_token):
    """Two sequential acks on same incident -> first acknowledged, second already_acknowledged."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # First acknowledgment - should succeed
    resp1 = client.post(
        f"/api/v1/incidents/{incident_for_ack}/acknowledge",
        headers=headers,
    )
    assert resp1.status_code == 200, f"First ack failed: {resp1.text}"
    data1 = resp1.json()
    assert data1["status"] == "acknowledged", f"Expected acknowledged, got: {data1}"

    # Second acknowledgment - should return already_acknowledged
    resp2 = client.post(
        f"/api/v1/incidents/{incident_for_ack}/acknowledge",
        headers=headers,
    )
    assert resp2.status_code == 200, f"Second ack failed: {resp2.text}"
    data2 = resp2.json()
    assert data2["status"] == "already_acknowledged", f"Expected already_acknowledged, got: {data2}"

    # Both responses must have identical acknowledged_by and acknowledged_at
    assert data1["acknowledged_by"] == data2["acknowledged_by"], (
        f"acknowledged_by mismatch: {data1['acknowledged_by']} vs {data2['acknowledged_by']}"
    )
    assert data1["acknowledged_at"] == data2["acknowledged_at"], (
        f"acknowledged_at mismatch: {data1['acknowledged_at']} vs {data2['acknowledged_at']}"
    )