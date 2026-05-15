"""drop legacy squad_virtual_account_id column

The User model carried two columns for the same Squad identifier:
  - squad_account_id            (canonical, set from Squad response)
  - squad_virtual_account_id    (legacy mirror)

Nothing in the application reads squad_virtual_account_id; it was only
mirror-written for backwards compatibility. Dropping it now so there is a
single canonical column.

Revision ID: 006_drop_legacy_squad_va_field
Revises: 005_admin_dashboard_tables
Create Date: 2026-05-14 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers
revision = "006_drop_legacy_squad_va_field"
down_revision = "005_admin_dashboard_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Skip for SQLite - tables created by ORM on first startup
    if op.get_context().dialect.name == 'sqlite':
        return
    
    op.drop_column("users", "squad_virtual_account_id")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("squad_virtual_account_id", sa.String(length=100), nullable=True),
    )
