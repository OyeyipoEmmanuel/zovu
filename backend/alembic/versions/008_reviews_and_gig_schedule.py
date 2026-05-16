"""reviews table + gig direct_location/scheduled_at

Revision ID: 008_reviews_and_gig_schedule
Revises: 007_ajo_and_lender_services
Create Date: 2026-05-15 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "008_reviews_and_gig_schedule"
down_revision = "007_ajo_and_lender_services"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        # SQLite dev: tables/columns are created by ORM metadata.create_all()
        # and patched in src/core/database.py::_apply_schema_patches.
        return

    # Gig: direct_location + scheduled_at
    op.add_column("gigs", sa.Column("direct_location", sa.String(length=500), nullable=True))
    op.add_column("gigs", sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True))

    # Reviews
    op.create_table(
        "reviews",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("reviewer_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewee_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gig_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("gigs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("reviewer_role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        sa.UniqueConstraint("reviewer_id", "reviewee_id", "gig_id", name="uq_review_per_gig"),
    )
    op.create_index("ix_reviews_reviewee_id", "reviews", ["reviewee_id"])
    op.create_index("ix_reviews_reviewer_id", "reviews", ["reviewer_id"])
    op.create_index("ix_reviews_gig_id", "reviews", ["gig_id"])


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        return

    op.drop_index("ix_reviews_gig_id", table_name="reviews")
    op.drop_index("ix_reviews_reviewer_id", table_name="reviews")
    op.drop_index("ix_reviews_reviewee_id", table_name="reviews")
    op.drop_table("reviews")

    op.drop_column("gigs", "scheduled_at")
    op.drop_column("gigs", "direct_location")
