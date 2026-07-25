"""Script to seed default ADMIN and STAFF users for development.

Usage:
    python -m backend.scripts.seed_admin
"""

import asyncio
import os

from sqlalchemy import select

from backend.app.core.security import hash_password
from backend.app.database import async_session_maker, init_db
from backend.app.models.user import User
from backend.app.schemas.enums import Role


async def seed() -> None:
    await init_db()

    users_to_seed = [
        ("admin", os.environ.get("ADMIN_SEED_PASSWORD", "adminpassword"), Role.ADMIN),
        ("staff", os.environ.get("STAFF_SEED_PASSWORD", "staffpassword"), Role.STAFF),
    ]

    async with async_session_maker() as session:
        for username, password, role in users_to_seed:
            result = await session.execute(
                select(User).where(User.username == username)
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"User '{username}' already exists — skipping")
                continue

            user = User(
                username=username,
                password_hash=hash_password(password),
                role=role,
            )
            session.add(user)
            await session.commit()
            print(f"User '{username}' ({role.value}) created successfully with password '{password}'")


if __name__ == "__main__":
    asyncio.run(seed())
