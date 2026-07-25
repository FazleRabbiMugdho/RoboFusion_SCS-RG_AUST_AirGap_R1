from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.zone import Zone


async def validate_and_advance_seq(
    db_session: AsyncSession,
    zone_id: int,
    incoming_seq: int,
) -> bool:
    """
    Returns True if incoming_seq is accepted (strictly greater than
    last_accepted_seq), updating last_accepted_seq in the process.
    Returns False if incoming_seq <= last_accepted_seq (duplicate or reorder).

    Acquires SELECT ... FOR UPDATE row lock on the zones row before
    comparing to prevent race conditions on concurrent requests.

    The caller is responsible for the DB transaction; this function
    does not commit/rollback.
    """
    # Acquire row lock before reading
    result = await db_session.execute(
        select(Zone)
        .where(Zone.id == zone_id)
        .with_for_update()
    )
    zone = result.scalar_one_or_none()
    if zone is None:
        return False

    if incoming_seq <= zone.last_accepted_seq:
        return False

    zone.last_accepted_seq = incoming_seq
    await db_session.flush()
    return True