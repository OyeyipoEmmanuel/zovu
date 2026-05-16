"""ajo_transactions paid_at + on_time, ajos next_due_date

Revision ID: 009_ajo_contribution_tracking
Revises: 008_reviews_and_gig_schedule
Create Date: 2026-05-16 09:00:00.000000

Adds the fields needed to track Ajo contribution settlement times and
on-time/late flags. paid_at is set when the Squad webhook confirms the
inbound payment; on_time compares paid_at against ajos.next_due_date
(or ajos.end_date when next_due_date is null).
"""
from alembic import op
import sqlalchemy as sa


revision = "009_ajo_contribution_tracking"
down_revision = "008_reviews_and_gig_schedule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        # SQLite dev: handled by src/core/database.py::_apply_schema_patches.
        return

    op.add_column(
        "ajo_transactions",
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "ajo_transactions",
        sa.Column("on_time", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "ajos",
        sa.Column("next_due_date", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        return

    op.drop_column("ajos", "next_due_date")
    op.drop_column("ajo_transactions", "on_time")
    op.drop_column("ajo_transactions", "paid_at")
