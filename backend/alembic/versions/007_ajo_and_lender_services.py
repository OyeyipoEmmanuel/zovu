"""ajo end_date + merchant_squad_account, ajo_transactions, lender_service_offerings

Revision ID: 007_ajo_and_lender_services
Revises: 006_drop_legacy_squad_va_field
Create Date: 2026-05-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "007_ajo_and_lender_services"
down_revision = "006_drop_legacy_squad_va_field"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        # SQLite dev: tables/columns are created by ORM metadata.create_all()
        return

    # Add end_date + merchant_squad_account to ajos
    op.add_column("ajos", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ajos", sa.Column("merchant_squad_account", sa.String(length=20), nullable=True))

    # Lender service offerings
    op.create_table(
        "lender_service_offerings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("lender_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("min_pulse_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_amount", sa.Integer(), nullable=True),
        sa.Column("interest_rate", sa.Float(), nullable=True),
        sa.Column("premium_amount", sa.Integer(), nullable=True),
        sa.Column("repayment_days", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_lender_service_offerings_lender_id", "lender_service_offerings", ["lender_id"])
    op.create_index("ix_lender_service_offerings_type", "lender_service_offerings", ["type"])

    # Ajo transactions
    op.create_table(
        "ajo_transactions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("ajo_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("ajos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
        sa.Column("squad_reference", sa.String(length=100), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ajo_transactions_ajo_id", "ajo_transactions", ["ajo_id"])
    op.create_index("ix_ajo_transactions_user_id", "ajo_transactions", ["user_id"])


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        return

    op.drop_index("ix_ajo_transactions_user_id", table_name="ajo_transactions")
    op.drop_index("ix_ajo_transactions_ajo_id", table_name="ajo_transactions")
    op.drop_table("ajo_transactions")

    op.drop_index("ix_lender_service_offerings_type", table_name="lender_service_offerings")
    op.drop_index("ix_lender_service_offerings_lender_id", table_name="lender_service_offerings")
    op.drop_table("lender_service_offerings")

    op.drop_column("ajos", "merchant_squad_account")
    op.drop_column("ajos", "end_date")
