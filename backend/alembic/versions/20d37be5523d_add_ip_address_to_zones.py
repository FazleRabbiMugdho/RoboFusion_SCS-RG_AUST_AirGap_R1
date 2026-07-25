"""add ip_address to zones for actuation dispatch

Revision ID: 20d37be5523d
Revises: 5c646e506693
Create Date: 2026-07-25 16:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20d37be5523d'
down_revision: str | Sequence[str] | None = '5c646e506693'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('zones', sa.Column('ip_address', sa.String(45), nullable=True))


def downgrade() -> None:
    op.drop_column('zones', 'ip_address')
