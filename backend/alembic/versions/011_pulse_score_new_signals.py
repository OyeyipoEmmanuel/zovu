"""pulse score: add punctuality, insurance discipline, reputation signals

Revision ID: 011_pulse_score_new_signals
Revises: 010_job_escrow_state_machine
Create Date: 2026-05-16 14:00:00.000000

Task 6 — Extended Pulse Score signals.

Adds three new 0-100 signal columns to pulse_scores. The Python service layer
(src/services/pulse_score.py) re-weights the original six signals by 0.85 so
each new signal can take a 0.05 slice and the total still sums to exactly 1.0.

Columns added (all integer, default 0):
    punctuality_signal           — gig arrival on/before scheduled_at
    insurance_discipline_signal  — Shield/insurance recurring payment success
    reputation_signal            — average review rating (1-5 → 0-100)
"""
from alembic import op
import sqlalchemy as sa


revision = "011_pulse_score_new_signals"
down_revision = "010_job_escrow_state_machine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        # SQLite dev: src/core/database.py::_apply_schema_patches handles it.
        return

    op.add_column(
        "pulse_scores",
        sa.Column("punctuality_signal", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "pulse_scores",
        sa.Column("insurance_discipline_signal", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "pulse_scores",
        sa.Column("reputation_signal", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        return

    op.drop_column("pulse_scores", "reputation_signal")
    op.drop_column("pulse_scores", "insurance_discipline_signal")
    op.drop_column("pulse_scores", "punctuality_signal")
