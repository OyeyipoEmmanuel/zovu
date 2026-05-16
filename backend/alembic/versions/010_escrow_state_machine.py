"""Escrow state machine — gig_applications escrow fields + support_tickets table

Revision ID: 010_escrow_state_machine
Revises: 009_ajo_contribution_tracking
Create Date: 2026-05-16 11:00:00.000000

Adds the fields and table needed for the trader-confirms-seeker escrow flow:

- gig_applications.reserved_amount   (kobo, set when the trader accepts)
- gig_applications.worker_done_at    (timestamp, set when seeker marks done)
- gig_applications.confirmation_deadline_at  (timestamp, deadline for trader)
- support_tickets table              (escrow timeouts surface here for staff)

`gig_applications.status` itself stays a free-text VARCHAR — the state machine
is enforced in the service layer rather than at the DB. Valid values:
escrow_held, waiting_for_worker, worker_done, trader_confirmed,
trader_disputed, in_dispute, resolved_paid, resolved_refunded
(plus legacy: pending, accepted, rejected).
"""
from alembic import op
import sqlalchemy as sa


revision = "010_escrow_state_machine"
down_revision = "009_ajo_contribution_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        # SQLite dev: handled by src/core/database.py::_apply_schema_patches.
        return

    op.add_column("gig_applications", sa.Column("reserved_amount", sa.Integer(), nullable=True))
    op.add_column("gig_applications", sa.Column("worker_done_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("gig_applications", sa.Column("confirmation_deadline_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "support_tickets",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("reference_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_support_tickets_type", "support_tickets", ["type"])
    op.create_index("ix_support_tickets_reference_id", "support_tickets", ["reference_id"])
    op.create_index("ix_support_tickets_status", "support_tickets", ["status"])


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        return

    op.drop_index("ix_support_tickets_status", table_name="support_tickets")
    op.drop_index("ix_support_tickets_reference_id", table_name="support_tickets")
    op.drop_index("ix_support_tickets_type", table_name="support_tickets")
    op.drop_table("support_tickets")

    op.drop_column("gig_applications", "confirmation_deadline_at")
    op.drop_column("gig_applications", "worker_done_at")
    op.drop_column("gig_applications", "reserved_amount")
