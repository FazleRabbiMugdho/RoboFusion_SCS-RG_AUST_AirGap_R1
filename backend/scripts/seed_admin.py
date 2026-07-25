"""One-off script to seed an ADMIN user from environment variables.

Usage:
    ADMIN_SEED_USERNAME=admin ADMIN_SEED_PASSWORD=<secret> python -m backend.scripts.seed_admin

Requires DATABASE_URL in the environment.
"""

import asyncio
import os

from sqlalchemy import select

from backend.app.core.security import hash_password
from backend.app.database import async_session_maker
from backend.app.models.user import User
from backend.app.schemas.enums import Role


async def seed() -> None:
    username = os.environ.get("ADMIN_SEED_USERNAME")
    password = os.environ.get("ADMIN_SEED_PASSWORD")

    if not username or not password:
        print("ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD must be set")
        return

    async with async_session_maker() as session:
        result = await session.execute(
            select(User).where(User.username == username)
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Admin user '{username}' already exists — skipping")
            return

        user = User(
            username=username,
            password_hash=hash_password(password),
            role=Role.ADMIN,
        )
        session.add(user)
        await session.commit()
        print(f"Admin user '{username}' created")


if __name__ == "__main__":
    asyncio.run(seed())
