"""Replace transaction.user_id with sender_id and receiver_id

Revision ID: 002_transaction_sender_receiver
Revises: 001_initial_schema
Create Date: 2025-05-11 00:00:00.000000

Why: A transaction always has a direction — money moves FROM someone TO someone.
     A single user_id can't represent both sides.

Direction mapping for existing rows (migrated via transaction_type):
  CREDIT_DEPOSIT      -> sender=NULL,     receiver=user_id  (money from external bank → user)
  CREDIT_WITHDRAWAL   -> sender=user_id,  receiver=NULL     (user → external bank)
  LOAN_DISBURSEMENT   -> sender=NULL,     receiver=user_id  (Zovu system → borrower)
  LOAN_REPAYMENT      -> sender=user_id,  receiver=NULL     (borrower → Zovu system)
  AJO_CONTRIBUTION    -> sender=user_id,  receiver=NULL     (member → ajo pool)
  AJO_PAYOUT          -> sender=NULL,     receiver=user_id  (ajo pool → member)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '002_transaction_sender_receiver'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new nullable columns
    op.add_column(
        'transaction',
        sa.Column('sender_id', postgresql.UUID(as_uuid=False), nullable=True),
    )
    op.add_column(
        'transaction',
        sa.Column('receiver_id', postgresql.UUID(as_uuid=False), nullable=True),
    )

    # 2. Migrate existing data using transaction_type to infer direction
    op.execute("""
        UPDATE transaction SET
            sender_id = CASE
                WHEN transaction_type IN ('CREDIT_WITHDRAWAL', 'LOAN_REPAYMENT', 'AJO_CONTRIBUTION')
                THEN user_id
                ELSE NULL
            END,
            receiver_id = CASE
                WHEN transaction_type IN ('CREDIT_DEPOSIT', 'LOAN_DISBURSEMENT', 'AJO_PAYOUT')
                THEN user_id
                ELSE NULL
            END
    """)

    # 3. Add FK constraints
    op.create_foreign_key(
        'fk_transaction_sender_id',
        'transaction', 'user',
        ['sender_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_transaction_receiver_id',
        'transaction', 'user',
        ['receiver_id'], ['id'],
        ondelete='SET NULL',
    )

    # 4. Create new indexes
    op.create_index('ix_transaction_sender_id', 'transaction', ['sender_id'])
    op.create_index('ix_transaction_receiver_id', 'transaction', ['receiver_id'])

    # 5. Drop old index and column
    op.drop_index('ix_transaction_user_id', table_name='transaction')
    op.drop_column('transaction', 'user_id')


def downgrade() -> None:
    # 1. Re-add user_id column
    op.add_column(
        'transaction',
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=True),
    )

    # 2. Reverse-migrate: pick whichever side is not NULL
    op.execute("""
        UPDATE transaction SET
            user_id = COALESCE(sender_id, receiver_id)
    """)

    # 3. Restore FK and index
    op.create_foreign_key(
        'fk_transaction_user_id',
        'transaction', 'user',
        ['user_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_transaction_user_id', 'transaction', ['user_id'])

    # 4. Drop sender/receiver indexes and FKs
    op.drop_index('ix_transaction_sender_id', table_name='transaction')
    op.drop_index('ix_transaction_receiver_id', table_name='transaction')
    op.drop_constraint('fk_transaction_sender_id', 'transaction', type_='foreignkey')
    op.drop_constraint('fk_transaction_receiver_id', 'transaction', type_='foreignkey')
    op.drop_column('transaction', 'sender_id')
    op.drop_column('transaction', 'receiver_id')
