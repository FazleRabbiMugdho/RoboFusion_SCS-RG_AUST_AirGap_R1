import hashlib
import hmac
import logging
import os
from typing import TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from backend.app.models.zone import Zone

logger = logging.getLogger(__name__)


def compute_zone_api_key_hash(raw_api_key: str) -> str:
    salt = os.environ.get("ZONE_API_KEY_SALT", "").encode("utf-8")
    return hmac.new(salt, raw_api_key.encode("utf-8"), hashlib.sha256).hexdigest()


async def verify_zone_api_key(
    zone_id: int,
    x_zone_api_key: str,
    db: "AsyncSession",
) -> "Zone":
    """
    Verify zone API key using HMAC-SHA256 with constant-time comparison.
    Raises HTTPException 401 with "Invalid zone or API key" in both
    nonexistent-zone and wrong-key cases (identical error message to
    avoid zone enumeration).
    """
    from sqlalchemy import select

    from backend.app.models.zone import Zone

    result = await db.execute(
        select(Zone).where(Zone.id == zone_id)
    )
    zone = result.scalar_one_or_none()

    if zone is None:
        logger.warning("verify_zone_api_key zone_not_found zone_id=%d", zone_id)
        raise HTTPException(status_code=401, detail="Invalid zone or API key")

    key_hash = compute_zone_api_key_hash(x_zone_api_key)

    if not hmac.compare_digest(key_hash, zone.api_key_hash):
        logger.warning("verify_zone_api_key invalid_key zone_id=%d", zone_id)
        raise HTTPException(status_code=401, detail="Invalid zone or API key")

    return zone