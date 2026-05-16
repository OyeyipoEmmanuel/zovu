"""job escrow state machine

Revision ID: 010_job_escrow_state_machine
Revises: 009_ajo_contribution_tracking
Create Date: 2026-05-16 12:00:00.000000

Adds the escrow / dispute state-machine fields to gig_applications and
introduces a support_tickets table for the 24h-trader-silence timeout case.

Allowed gig_applications.status values (no enum constraint at DB level; the
state machine is enforced in the API layer):
    pending             # seeker applied, trader hasn't decided
    rejected            # trader picked someone else
    waiting_for_worker  # trader accepted, escrow reserved
    worker_done         # seeker marked the job done
    trader_confirmed    # trader confirmed, payout fired
    trader_disputed     # trader marked incomplete (transient → waiting_for_worker)
    in_dispute          # 24h elapsed with no trader action, support ticket open
    resolved_paid       # support resolved → paid to seeker
    resolved_refunded   # support resolved → refunded to trader
"""
from alembic import op
import sqlalchemy as sa


revision = "010_job_escrow_state_machine"
down_revision = "009_ajo_contribution_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        # SQLite dev: src/core/database.py::_apply_schema_patches handles it.
        return

    op.add_column("gig_applications", sa.Column("reserved_amount", sa.Integer(), nullable=True))
    op.add_column("gig_applications", sa.Column("worker_done_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("gig_applications", sa.Column("confirmation_deadline_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("gig_applications", sa.Column("celery_deadline_task_id", sa.String(length=255), nullable=True))
    op.add_column("gig_applications", sa.Column("note", sa.Text(), nullable=True))

    op.create_table(
        "support_tickets",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("reference_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
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

    op.drop_column("gig_applications", "note")
    op.drop_column("gig_applications", "celery_deadline_task_id")
    op.drop_column("gig_applications", "confirmation_deadline_at")
    op.drop_column("gig_applications", "worker_done_at")
    op.drop_column("gig_applications", "reserved_amount")
