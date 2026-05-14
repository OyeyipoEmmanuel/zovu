"""Add gig_applications, lender_unlocks, job_recommendations tables and Gig.payment_period

Revision ID: 004_new_tables
Revises: 003_signup_overhaul
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "004_new_tables"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add payment_period to gigs ────────────────────────────────────────────
    op.add_column("gigs", sa.Column("payment_period", sa.String(50), nullable=True))

    # ── gig_applications ─────────────────────────────────────────────────────
    op.create_table(
        "gig_applications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gig_id", sa.String(36), sa.ForeignKey("gigs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seeker_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("gig_id", "seeker_id", name="uq_gig_seeker_application"),
    )
    op.create_index("ix_gig_applications_gig_id", "gig_applications", ["gig_id"])
    op.create_index("ix_gig_applications_seeker_id", "gig_applications", ["seeker_id"])

    # ── lender_unlocks ────────────────────────────────────────────────────────
    op.create_table(
        "lender_unlocks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("lender_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("borrower_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("lender_id", "borrower_id", name="uq_lender_borrower_unlock"),
    )
    op.create_index("ix_lender_unlocks_lender_id", "lender_unlocks", ["lender_id"])
    op.create_index("ix_lender_unlocks_borrower_id", "lender_unlocks", ["borrower_id"])

    # ── job_recommendations ───────────────────────────────────────────────────
    op.create_table(
        "job_recommendations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("seeker_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gig_id", sa.String(36), sa.ForeignKey("gigs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("synergy_score", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("match_tags", sa.JSON, nullable=True),
        sa.Column("email_sent", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("viewed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("applied", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("seeker_id", "gig_id", name="uq_seeker_gig_recommendation"),
    )
    op.create_index("ix_job_recommendations_seeker_id", "job_recommendations", ["seeker_id"])
    op.create_index("ix_job_recommendations_gig_id", "job_recommendations", ["gig_id"])


def downgrade() -> None:
    op.drop_table("job_recommendations")
    op.drop_table("lender_unlocks")
    op.drop_table("gig_applications")
    op.drop_column("gigs", "payment_period")
