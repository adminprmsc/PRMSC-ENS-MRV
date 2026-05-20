"""add bill_reference_number to solar systems

Revision ID: d9879edd2c90
Revises: 00122d3c11c2
Create Date: 2026-05-20 12:18:26.414209

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d9879edd2c90"
down_revision = "00122d3c11c2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "solar_systems",
        sa.Column("bill_reference_number", sa.String(length=100), nullable=True),
    )


def downgrade():
    op.drop_column("solar_systems", "bill_reference_number")
