"""Escrow state machine compatibility revision

Revision ID: 010_escrow_state_machine
Revises: 010_job_escrow_state_machine
Create Date: 2026-05-16 11:00:00.000000

The complete escrow schema lives in 010_job_escrow_state_machine. This
revision is intentionally a no-op so Alembic has a single linear head while
preserving the older revision id for checkouts that may reference it.
"""

revision = "010_escrow_state_machine"
down_revision = "010_job_escrow_state_machine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    return


def downgrade() -> None:
    return
