"""initial schema

Revision ID: ad87e9800d85
Revises: 
Create Date: 2026-07-25 11:48:40.412916

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ad87e9800d85'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(length=100), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('STAFF', 'ADMIN', name='role_enum'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('username')
    )
    op.create_table('zones',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('lab_type', sa.Enum('IOT_LAB', 'ROBOTICS_LAB', 'SERVER_ROOM', 'DATA_SCIENCE_LAB', 'SOFTWARE_LAB', name='zone_lab_enum'), nullable=False),
    sa.Column('api_key_hash', sa.String(length=255), nullable=False),
    sa.Column('current_state', sa.Enum('SAFE', 'WARNING', 'CRITICAL', name='zone_state_enum'), nullable=False),
    sa.Column('last_accepted_seq', sa.BigInteger(), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('incidents',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('zone_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.Enum('SAFE', 'WARNING', 'CRITICAL', name='zone_state_enum'), nullable=False),
    sa.Column('risk_score', sa.Double(), nullable=False),
    sa.Column('triggered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('acknowledged_by', sa.Integer(), nullable=True),
    sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['acknowledged_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_incidents_status_triggered_at', 'incidents', ['status', 'triggered_at'], unique=False)
    op.create_table('sensors',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('zone_id', sa.Integer(), nullable=False),
    sa.Column('hazard_type', sa.Enum('FLAME', 'GAS', 'WATER', 'OCCUPANCY', name='hazard_type_enum'), nullable=False),
    sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('zone_id', 'hazard_type')
    )
    op.create_table('readings',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('sensor_id', sa.Integer(), nullable=False),
    sa.Column('seq_num', sa.BigInteger(), nullable=False),
    sa.Column('raw_value', sa.Double(), nullable=False),
    sa.Column('normalized_value', sa.Double(), nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['sensor_id'], ['sensors.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_readings_sensor_seq', 'readings', ['sensor_id', 'seq_num'], unique=False)
    op.execute("ALTER TABLE readings ADD CONSTRAINT ck_readings_normalized_range CHECK (normalized_value BETWEEN 0.0 AND 1.0)")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_readings_sensor_seq', table_name='readings')
    op.drop_table('readings')
    op.drop_table('sensors')
    op.drop_index('ix_incidents_status_triggered_at', table_name='incidents')
    op.drop_table('incidents')
    op.drop_table('zones')
    op.drop_table('users')
    op.execute("DROP TYPE IF EXISTS hazard_type_enum")
    op.execute("DROP TYPE IF EXISTS zone_state_enum")
    op.execute("DROP TYPE IF EXISTS zone_lab_enum")
    op.execute("DROP TYPE IF EXISTS role_enum")
