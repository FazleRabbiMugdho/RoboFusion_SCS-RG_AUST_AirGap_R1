"""One-off script to seed a zone row with a hashed API key.

Usage:
    ZONE_ID=1 ZONE_NAME="Main Lab" ZONE_LAB_TYPE=IOT_LAB ZONE_API_KEY=dev-zone-key-001 python -m backend.scripts.seed_zone

Requires DATABASE_URL and ZONE_API_KEY_SALT in the environment.
"""

import asyncio
import hashlib
import hmac
import os

from sqlalchemy import select

from backend.app.database import async_session_maker
from backend.app.models.zone import Zone
from backend.app.schemas.enums import LabType, ZoneState


async def seed() -> None:
    zone_id = int(os.environ.get("ZONE_ID", "1"))
    zone_name = os.environ.get("ZONE_NAME", "Main Lab")
    zone_lab_type_str = os.environ.get("ZONE_LAB_TYPE", "IOT_LAB")
    raw_api_key = os.environ.get("ZONE_API_KEY")
    salt = os.environ.get("ZONE_API_KEY_SALT", "").encode("utf-8")

    if not raw_api_key:
        print("ZONE_API_KEY must be set")
        return

    try:
        lab_type = LabType(zone_lab_type_str)
    except ValueError:
        print(f"Invalid ZONE_LAB_TYPE '{zone_lab_type_str}'. Valid: {[e.value for e in LabType]}")
        return

    key_hash = hmac.new(salt, raw_api_key.encode("utf-8"), hashlib.sha256).hexdigest()

    async with async_session_maker() as session:
        result = await session.execute(
            select(Zone).where(Zone.id == zone_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Zone id={zone_id} already exists — skipping")
            return

        zone = Zone(
            id=zone_id,
            name=zone_name,
            lab_type=lab_type,
            api_key_hash=key_hash,
            current_state=ZoneState.SAFE,
        )
        session.add(zone)
        await session.commit()
        print(f"Zone id={zone_id} '{zone_name}' created with API key hash")


if __name__ == "__main__":
    asyncio.run(seed())
