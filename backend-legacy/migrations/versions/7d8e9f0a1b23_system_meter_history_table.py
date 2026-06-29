"""Create system_meters table and backfill current meter data.

Revision ID: 7d8e9f0a1b23
Revises: 6c7d8e9f0a12
Create Date: 2026-05-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "7d8e9f0a1b23"
down_revision = "6c7d8e9f0a12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_meters",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("meter_type", sa.String(length=32), nullable=False),
        sa.Column("water_system_id", sa.String(length=36), nullable=True),
        sa.Column("solar_system_id", sa.String(length=36), nullable=True),
        sa.Column("meter_model", sa.String(length=100), nullable=True),
        sa.Column("meter_serial_number", sa.String(length=100), nullable=True),
        sa.Column("meter_accuracy_class", sa.String(length=50), nullable=True),
        sa.Column("installation_date", sa.Date(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["solar_system_id"], ["solar_systems.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["water_system_id"], ["water_systems.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_system_meters_water_system_id", "system_meters", ["water_system_id"], unique=False
    )
    op.create_index(
        "ix_system_meters_solar_system_id", "system_meters", ["solar_system_id"], unique=False
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_system_meters_active_water
        ON system_meters (water_system_id)
        WHERE is_active = true AND water_system_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_system_meters_active_solar
        ON system_meters (solar_system_id)
        WHERE is_active = true AND solar_system_id IS NOT NULL
        """
    )
    op.execute(
        """
        INSERT INTO system_meters (
            id, meter_type, water_system_id, meter_model, meter_serial_number,
            meter_accuracy_class, installation_date, is_active, created_at, updated_at
        )
        SELECT
            SUBSTRING(MD5(random()::text || clock_timestamp()::text || ws.id) FROM 1 FOR 36),
            'tubewell',
            ws.id,
            NULLIF(TRIM(COALESCE(ws.meter_model, '')), ''),
            NULLIF(TRIM(COALESCE(ws.meter_serial_number, '')), ''),
            NULLIF(TRIM(COALESCE(ws.meter_accuracy_class, '')), ''),
            ws.installation_date,
            true,
            NOW(),
            NOW()
        FROM water_systems ws
        WHERE
            NULLIF(TRIM(COALESCE(ws.meter_model, '')), '') IS NOT NULL
            OR NULLIF(TRIM(COALESCE(ws.meter_serial_number, '')), '') IS NOT NULL
            OR NULLIF(TRIM(COALESCE(ws.meter_accuracy_class, '')), '') IS NOT NULL
            OR ws.installation_date IS NOT NULL
        """
    )
    op.execute(
        """
        INSERT INTO system_meters (
            id, meter_type, solar_system_id, meter_model, meter_serial_number,
            installation_date, is_active, created_at, updated_at
        )
        SELECT
            SUBSTRING(MD5(random()::text || clock_timestamp()::text || ss.id) FROM 1 FOR 36),
            'solar',
            ss.id,
            NULLIF(TRIM(COALESCE(ss.meter_model, '')), ''),
            NULLIF(TRIM(COALESCE(ss.meter_serial_number, '')), ''),
            ss.green_connection_date,
            true,
            NOW(),
            NOW()
        FROM solar_systems ss
        WHERE
            NULLIF(TRIM(COALESCE(ss.meter_model, '')), '') IS NOT NULL
            OR NULLIF(TRIM(COALESCE(ss.meter_serial_number, '')), '') IS NOT NULL
            OR ss.green_connection_date IS NOT NULL
        """
    )
    op.alter_column("system_meters", "is_active", server_default=None)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_system_meters_active_solar")
    op.execute("DROP INDEX IF EXISTS uq_system_meters_active_water")
    op.drop_index("ix_system_meters_solar_system_id", table_name="system_meters")
    op.drop_index("ix_system_meters_water_system_id", table_name="system_meters")
    op.drop_table("system_meters")
