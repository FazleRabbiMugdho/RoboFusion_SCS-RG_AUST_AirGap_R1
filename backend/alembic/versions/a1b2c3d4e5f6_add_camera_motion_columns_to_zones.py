"""add camera motion columns to zones

Revision ID: a1b2c3d4e5f6
Revises: 20d37be5523d
Create Date: 2026-07-26 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: str | Sequence[str] | None = '20d37be5523d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('zones', sa.Column('last_camera_motion_score', sa.Float, nullable=True))
    op.add_column('zones', sa.Column('last_camera_motion_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('zones', sa.Column('last_camera_seq', sa.BigInteger, nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('zones', 'last_camera_motion_score')
    op.drop_column('zones', 'last_camera_motion_at')
    op.drop_column('zones', 'last_camera_seq')