"""Script to seed default ADMIN and STAFF users, and 5 lab zones for development.

Usage:
    python -m backend.scripts.seed_admin
"""

import asyncio
import os
from datetime import datetime, timezone

from sqlalchemy import select

from backend.app.core.security import hash_password
from backend.app.database import async_session_maker, init_db
from backend.app.models.user import User
from backend.app.models.zone import Zone
from backend.app.schemas.enums import LabType, Role, ZoneState


async def seed() -> None:
    await init_db()

    users_to_seed = [
        ("admin", os.environ.get("ADMIN_SEED_PASSWORD", "adminpassword"), Role.ADMIN),
        ("staff", os.environ.get("STAFF_SEED_PASSWORD", "staffpassword"), Role.STAFF),
    ]

    zones_to_seed = [
        ("Lab A — Assembly", LabType.IOT_LAB),
        ("Lab B — Battery Bay", LabType.SERVER_ROOM),
        ("Lab C — Cleanroom", LabType.SOFTWARE_LAB),
        ("Lab D — Storage", LabType.ROBOTICS_LAB),
        ("Lab E — Testing", LabType.DATA_SCIENCE_LAB),
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
            print(f"User '{username}' ({role.value}) created successfully")

        for zone_name, lab_type in zones_to_seed:
            result = await session.execute(
                select(Zone).where(Zone.name == zone_name)
            )
            existing_zone = result.scalar_one_or_none()
            if existing_zone:
                print(f"Zone '{zone_name}' already exists — skipping")
                continue

            zone = Zone(
                name=zone_name,
                lab_type=lab_type,
                api_key_hash="dummy_key_hash",
                current_state=ZoneState.SAFE,
                last_seen_at=datetime.now(timezone.utc),
            )
            session.add(zone)
            await session.commit()
            print(f"Zone '{zone_name}' ({lab_type.value}) created successfully")


if __name__ == "__main__":
    asyncio.run(seed())
