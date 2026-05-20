"""add indexes for dashboard query performance

Revision ID: 8e9f0a1b2c34
Revises: 7d8e9f0a1b23
Create Date: 2026-05-12 11:15:00.000000
"""

from alembic import op


revision = "8e9f0a1b2c34"
down_revision = "7d8e9f0a1b23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Filters by tehsil/village are used across dashboard endpoints.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_water_systems_tehsil_village "
        "ON water_systems (tehsil, village)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_solar_systems_tehsil_village "
        "ON solar_systems (tehsil, village)"
    )

    # Bulk meter counting filters meter_type + is_active and joins by water_system_id.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_system_meters_type_active_water "
        "ON system_meters (meter_type, is_active, water_system_id)"
    )

    # Monthly water aggregates filter by log_date and skip rejected rows.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_water_log_non_rejected_date_system "
        "ON water_energy_logging_daily (log_date, water_system_id) "
        "WHERE status IS NULL OR status <> 'rejected'"
    )

    # Solar monthly aggregates join by system and filter by year/month.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_solar_log_system_year_month "
        "ON solar_energy_logging_monthly (solar_system_id, year, month)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_solar_log_system_year_month")
    op.execute("DROP INDEX IF EXISTS ix_water_log_non_rejected_date_system")
    op.execute("DROP INDEX IF EXISTS ix_system_meters_type_active_water")
    op.execute("DROP INDEX IF EXISTS ix_solar_systems_tehsil_village")
    op.execute("DROP INDEX IF EXISTS ix_water_systems_tehsil_village")
