"""add disco_info to solar systems

Revision ID: 00122d3c11c2
Revises: 8e9f0a1b2c34
Create Date: 2026-05-20 12:06:28.557066

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '00122d3c11c2'
down_revision = '8e9f0a1b2c34'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("solar_systems", sa.Column("disco_info", sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column("solar_systems", "disco_info")

