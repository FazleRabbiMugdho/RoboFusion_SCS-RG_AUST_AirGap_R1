from sqlalchemy.ext.asyncio import AsyncSession


async def validate_and_advance_seq(
    db_session: AsyncSession,
    zone,
    seq_num: int,
) -> bool:
    """
    Returns True if seq_num is accepted (strictly greater than
    last_accepted_seq), updating last_accepted_seq in the process.
    Returns False if seq_num <= last_accepted_seq (duplicate or reorder).
    The caller is responsible for the DB transaction.
    """
    if seq_num <= zone.last_accepted_seq:
        return False
    zone.last_accepted_seq = seq_num
    await db_session.flush()
    return True