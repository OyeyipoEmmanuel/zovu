"""user location coordinates

Revision ID: 012_user_location_coords
Revises: 011_pulse_score_new_signals
Create Date: 2026-05-16 13:00:00.000000

Adds latitude/longitude columns to the users table for Task 9 (geolocation —
insert trader phone into job note on hire). Existing free-text `location`
column is kept untouched; these new columns are GPS coordinates from device
sensors used to compute the haversine distance between a seeker and a trader.

Re-parented onto 011_pulse_score_new_signals to keep the Alembic graph linear
after Task 6's migration landed in parallel.
"""
from alembic import op
import sqlalchemy as sa


revision = "012_user_location_coords"
down_revision = "011_pulse_score_new_signals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        # SQLite dev: src/core/database.py::_apply_schema_patches handles it.
        return

    op.add_column("users", sa.Column("location_lat", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("location_lng", sa.Float(), nullable=True))


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        return

    op.drop_column("users", "location_lng")
    op.drop_column("users", "location_lat")
