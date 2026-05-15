"""Signup overhaul: new user fields + refresh token enhancements

Revision ID: 003_signup_overhaul
Revises: 002_transaction_sender_receiver
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# Revision identifiers
revision = "003_signup_overhaul"
down_revision = "002_transaction_sender_receiver"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add new signup-flow columns to users and refresh_tokens.
    All columns are nullable / have server defaults so this is
    safe to run against a live database without downtime.
    """
    # Skip for SQLite - tables created by ORM on first startup
    if op.get_context().dialect.name == 'sqlite':
        return

    # ------------------------------------------------------------------ #
    #  users table                                                         #
    # ------------------------------------------------------------------ #

    # New role field (trader | job_seeker | lender)
    op.add_column("users", sa.Column("role", sa.String(20), nullable=True))

    # Email verification
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Role-specific name fields
    op.add_column("users", sa.Column("full_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("company_name", sa.String(255), nullable=True))

    # Squad provisioning
    op.add_column("users", sa.Column("squad_account_id", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("squad_account_bank", sa.String(100), nullable=True))
    op.add_column(
        "users",
        sa.Column("squad_provisioned", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Profile / ban state
    op.add_column(
        "users",
        sa.Column("profile_complete", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("is_banned", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("users", sa.Column("ban_reason", sa.Text(), nullable=True))

    # ------------------------------------------------------------------ #
    #  refresh_tokens table                                                #
    # ------------------------------------------------------------------ #

    op.add_column(
        "refresh_tokens",
        sa.Column("device_fingerprint", sa.String(500), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Index on token_hash for fast rotation lookups
    op.create_index(
        "ix_refresh_tokens_token_hash",
        "refresh_tokens",
        ["token_hash"],
        unique=False,
    )


def downgrade() -> None:
    """Remove all columns added in upgrade()."""

    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")

    op.drop_column("refresh_tokens", "used_at")
    op.drop_column("refresh_tokens", "device_fingerprint")

    op.drop_column("users", "ban_reason")
    op.drop_column("users", "is_banned")
    op.drop_column("users", "profile_complete")
    op.drop_column("users", "squad_provisioned")
    op.drop_column("users", "squad_account_bank")
    op.drop_column("users", "squad_account_id")
    op.drop_column("users", "company_name")
    op.drop_column("users", "full_name")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "role")
