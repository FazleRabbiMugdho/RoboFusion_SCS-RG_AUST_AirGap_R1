import os

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

# Set test database URL before importing app
TEST_DB_PATH = "test_rbac.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

# Re-import modules after setting DATABASE_URL
import importlib

import backend.app.core.security
import backend.app.database
import backend.app.main
import backend.app.schemas.enums

importlib.reload(backend.app.main)
importlib.reload(backend.app.database)
importlib.reload(backend.app.core.security)

from backend.app.core.security import create_access_token, hash_password
from backend.app.database import Base, async_session_maker
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.enums import Role

client = TestClient(app)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Set up test database once per session."""
    from backend.app.database import engine
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    # Create test users
    async with async_session_maker() as db:
        admin_user = User(
            username="admin_test",
            password_hash=hash_password("adminpass"),
            role=Role.ADMIN,
        )
        staff_user = User(
            username="staff_test",
            password_hash=hash_password("staffpass"),
            role=Role.STAFF,
        )
        db.add(admin_user)
        db.add(staff_user)
        await db.commit()
        await db.refresh(admin_user)
        await db.refresh(staff_user)
    
    yield
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    import os
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Provide a database session for tests."""
    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest.fixture
def get_admin_token():
    """Return JWT token for admin user (id=1)."""
    return create_access_token(user_id=1, role=Role.ADMIN)


@pytest.fixture
def get_staff_token():
    """Return JWT token for staff user (id=2)."""
    return create_access_token(user_id=2, role=Role.STAFF)