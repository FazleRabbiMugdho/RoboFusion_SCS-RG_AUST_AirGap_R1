import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import create_access_token
from backend.app.main import app
from backend.app.schemas.enums import Role

client = TestClient(app)

EXPECTED_ADMIN_ROUTES = {
    ("GET", "/api/v1/admin/zones/health"),
    ("POST", "/api/v1/admin/zones/{zone_id}/override"),
    ("GET", "/api/v1/admin/zones/predicted-risk"),
}


@pytest.fixture(scope="session")
def openapi_schema():
    """Get OpenAPI schema from the app."""
    return app.openapi()


def test_admin_routes_registered_in_openapi(openapi_schema):
    """Verify all expected admin routes are present in OpenAPI schema."""
    paths = openapi_schema.get("paths", {})
    missing = []

    for method, path in EXPECTED_ADMIN_ROUTES:
        if path not in paths:
            missing.append(f"{method} {path} (path not found)")
        elif method.lower() not in paths[path]:
            missing.append(f"{method} {path} (method not found)")

    assert not missing, f"Missing expected admin routes in OpenAPI: {missing}"


def test_admin_routes_have_bearer_auth(openapi_schema):
    """Verify all expected admin routes require bearer auth."""
    paths = openapi_schema.get("paths", {})
    security_errors = []

    for method, path in EXPECTED_ADMIN_ROUTES:
        path_obj = paths.get(path)
        if not path_obj:
            continue

        method_obj = path_obj.get(method.lower())
        if not method_obj:
            continue

        # Check for security requirement with HTTPBearer (FastAPI's default name)
        security = method_obj.get("security", [])
        has_bearer = any("HTTPBearer" in s for s in security)

        if not has_bearer:
            security_errors.append(f"{method} {path} missing HTTPBearer security requirement")

    assert not security_errors, f"Admin routes missing bearer auth: {security_errors}"


@pytest.mark.asyncio
async def test_admin_health_requires_auth():
    """GET /admin/zones/health returns 401 without token."""
    resp = client.get("/api/v1/admin/zones/health")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_override_requires_auth():
    """POST /admin/zones/{zone_id}/override returns 401 without token."""
    resp = client.post("/api/v1/admin/zones/1/override", json={"buzzer": True, "led": True, "relay": True})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_predicted_risk_requires_auth():
    """GET /admin/zones/predicted-risk returns 401 without token."""
    resp = client.get("/api/v1/admin/zones/predicted-risk")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_health_forbidden_for_staff(get_staff_token):
    """Staff token gets 403 on admin endpoints."""
    resp = client.get(
        "/api/v1/admin/zones/health",
        headers={"Authorization": f"Bearer {get_staff_token}"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_override_forbidden_for_staff(get_staff_token):
    """Staff token gets 403 on override endpoint."""
    resp = client.post(
        "/api/v1/admin/zones/1/override",
        headers={"Authorization": f"Bearer {get_staff_token}"},
        json={"buzzer": True, "led": True, "relay": True}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_predicted_risk_forbidden_for_staff(get_staff_token):
    """Staff token gets 403 on predicted-risk endpoint."""
    resp = client.get(
        "/api/v1/admin/zones/predicted-risk",
        headers={"Authorization": f"Bearer {get_staff_token}"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_health_allowed_for_admin(get_admin_token):
    """Admin token gets 200 on admin endpoints (or 404 if no zones, but not 401/403)."""
    resp = client.get(
        "/api/v1/admin/zones/health",
        headers={"Authorization": f"Bearer {get_admin_token}"}
    )
    assert resp.status_code not in (401, 403)


@pytest.fixture
def get_admin_token():
    """Return JWT token for admin user (id=1)."""
    return create_access_token(user_id=1, role=Role.ADMIN)


@pytest.fixture
def get_staff_token():
    """Return JWT token for staff user (id=2)."""
    return create_access_token(user_id=2, role=Role.STAFF)