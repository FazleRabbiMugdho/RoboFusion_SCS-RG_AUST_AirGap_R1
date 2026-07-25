"""add pending_band and pending_count to zones table

Revision ID: 93fabc317b98
Revises: ad87e9800d85
Create Date: 2026-07-25 14:20:58.378197

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '93fabc317b98'
down_revision: Union[str, Sequence[str], None] = 'ad87e9800d85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "zones",
        sa.Column(
            "pending_band",
            sa.Enum("SAFE", "WARNING", "CRITICAL", name="zone_state_enum", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "zones",
        sa.Column("pending_count", sa.Integer(), nullable=False, default=0),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("zones", "pending_count")
    op.drop_column("zones", "pending_band")
