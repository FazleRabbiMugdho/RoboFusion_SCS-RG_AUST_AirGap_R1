"""add state_since and last_risk_breakdown to zones

Revision ID: 5c646e506693
Revises: 93fabc317b98
Create Date: 2026-07-25 15:30:36.075509

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5c646e506693'
down_revision: str | Sequence[str] | None = '93fabc317b98'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('zones', sa.Column('state_since', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('zones', sa.Column('last_risk_breakdown', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('zones', 'last_risk_breakdown')
    op.drop_column('zones', 'state_since')