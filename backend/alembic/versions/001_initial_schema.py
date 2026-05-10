"""Initial migration: create all 13 tables

Revision ID: 001_initial_schema
Revises: 
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# Revision identifiers
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create all 13 tables."""
    
    # Create enum types
    op.execute("CREATE TYPE user_role AS ENUM ('user', 'admin')")
    op.execute("CREATE TYPE user_status AS ENUM ('ACTIVE', 'SOFT_FROZEN')")
    op.execute("CREATE TYPE transaction_type AS ENUM ('CREDIT_DEPOSIT', 'CREDIT_WITHDRAWAL', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'AJO_CONTRIBUTION', 'AJO_PAYOUT')")
    op.execute("CREATE TYPE loan_status AS ENUM ('PENDING', 'APPROVED', 'DISBURSED', 'REPAYING', 'COMPLETED', 'DEFAULTED')")
    op.execute("CREATE TYPE ajo_status AS ENUM ('ACTIVE', 'COMPLETED', 'CLOSED')")
    op.execute("CREATE TYPE contribution_frequency AS ENUM ('weekly', 'biweekly', 'monthly')")
    op.execute("CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED')")
    op.execute("CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'expired')")
    
    # 1. User table
    op.create_table(
        'user',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('email', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('first_name', sa.String(100)),
        sa.Column('last_name', sa.String(100)),
        sa.Column('phone', sa.LargeBinary()),
        sa.Column('date_of_birth', sa.Date()),
        sa.Column('bvn', sa.LargeBinary()),
        sa.Column('nin', sa.LargeBinary()),
        sa.Column('kyc_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('pulse_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('squad_customer_id', sa.String(255)),
        sa.Column('squad_virtual_account_number', sa.String(20)),
        sa.Column('role', postgresql.ENUM('user', 'admin', name='user_role'), nullable=False, server_default='user'),
        sa.Column('status', postgresql.ENUM('ACTIVE', 'SOFT_FROZEN', name='user_status'), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_user_email', 'user', ['email'])
    op.create_index('ix_user_squad_customer_id', 'user', ['squad_customer_id'])
    
    # 2. Device table
    op.create_table(
        'device',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('fingerprint', sa.String(255), nullable=False),
        sa.Column('device_name', sa.String(255)),
        sa.Column('user_agent', sa.Text()),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('is_trusted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_used_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_device_user_id', 'device', ['user_id'])
    op.create_index('ix_device_fingerprint', 'device', ['fingerprint'])
    
    # 3. OTP table
    op.create_table(
        'otp',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('email', sa.String(255), nullable=False, index=True),
        sa.Column('code_hash', sa.String(255), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_otp_email', 'otp', ['email'])
    
    # 4. RefreshToken table
    op.create_table(
        'refresh_token',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('family_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('jti', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_refresh_token_user_id', 'refresh_token', ['user_id'])
    op.create_index('ix_refresh_token_family_id', 'refresh_token', ['family_id'])
    
    # 5. Credit table
    op.create_table(
        'credit',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False, unique=True),
        sa.Column('available_balance', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('reserved_balance', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.CheckConstraint('available_balance >= 0'),
        sa.CheckConstraint('reserved_balance >= 0'),
    )
    op.create_index('ix_credit_user_id', 'credit', ['user_id'])
    
    # 6. Loan table
    op.create_table(
        'loan',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('principal_amount', sa.BigInteger(), nullable=False),
        sa.Column('interest_amount', sa.BigInteger(), nullable=False),
        sa.Column('total_repayment', sa.BigInteger(), nullable=False),
        sa.Column('amount_repaid', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('tenure_days', sa.Integer(), nullable=False),
        sa.Column('status', postgresql.ENUM('PENDING', 'APPROVED', 'DISBURSED', 'REPAYING', 'COMPLETED', 'DEFAULTED', name='loan_status'), nullable=False, server_default='PENDING'),
        sa.Column('due_date', sa.DateTime(timezone=True)),
        sa.Column('disbursal_date', sa.DateTime(timezone=True)),
        sa.Column('squad_transaction_id', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.CheckConstraint('principal_amount > 0'),
        sa.CheckConstraint('tenure_days IN (7, 14, 30, 60)'),
        sa.CheckConstraint('amount_repaid >= 0'),
    )
    op.create_index('ix_loan_user_id', 'loan', ['user_id'])
    op.create_index('ix_loan_status', 'loan', ['status'])
    op.create_index('ix_loan_created_at', 'loan', ['created_at'])
    
    # 7. Transaction table
    op.create_table(
        'transaction',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('transaction_type', postgresql.ENUM('CREDIT_DEPOSIT', 'CREDIT_WITHDRAWAL', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'AJO_CONTRIBUTION', 'AJO_PAYOUT', name='transaction_type'), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('status', postgresql.ENUM('PENDING', 'COMPLETED', 'FAILED', name='transaction_status'), nullable=False, server_default='PENDING'),
        sa.Column('squad_reference', sa.String(255)),
        sa.Column('loan_id', postgresql.UUID(as_uuid=False)),
        sa.Column('metadata', postgresql.JSONB(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['loan_id'], ['loan.id'], ondelete='SET NULL'),
        sa.CheckConstraint('amount > 0'),
    )
    op.create_index('ix_transaction_user_id', 'transaction', ['user_id'])
    op.create_index('ix_transaction_type', 'transaction', ['transaction_type'])
    op.create_index('ix_transaction_created_at', 'transaction', ['created_at'])
    op.create_index('ix_transaction_squad_reference', 'transaction', ['squad_reference'])
    
    # 8. Job table
    op.create_table(
        'job',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False, unique=True),
        sa.Column('employer_name', sa.String(255)),
        sa.Column('job_title', sa.String(255)),
        sa.Column('monthly_income', sa.BigInteger()),
        sa.Column('employment_start_date', sa.Date()),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.CheckConstraint('monthly_income >= 0'),
    )
    op.create_index('ix_job_user_id', 'job', ['user_id'])
    
    # 9. Ajo table
    op.create_table(
        'ajo',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('organizer_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('contribution_amount', sa.BigInteger()),
        sa.Column('contribution_frequency', postgresql.ENUM('weekly', 'biweekly', 'monthly', name='contribution_frequency')),
        sa.Column('payout_schedule', postgresql.JSONB(), server_default='[]'),
        sa.Column('status', postgresql.ENUM('ACTIVE', 'COMPLETED', 'CLOSED', name='ajo_status'), nullable=False, server_default='ACTIVE'),
        sa.Column('current_balance', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('max_members', sa.Integer()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['organizer_id'], ['user.id'], ondelete='CASCADE'),
        sa.CheckConstraint('contribution_amount > 0'),
        sa.CheckConstraint('current_balance >= 0'),
        sa.CheckConstraint('max_members >= 2 AND max_members <= 50'),
    )
    op.create_index('ix_ajo_organizer_id', 'ajo', ['organizer_id'])
    op.create_index('ix_ajo_status', 'ajo', ['status'])
    
    # 10. AjoMembership table
    op.create_table(
        'ajo_membership',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('ajo_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('payout_order', sa.Integer(), nullable=False),
        sa.Column('contributed_amount', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('received_amount', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['ajo_id'], ['ajo.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('ajo_id', 'user_id', name='uq_ajo_membership'),
        sa.CheckConstraint('contributed_amount >= 0'),
        sa.CheckConstraint('received_amount >= 0'),
    )
    op.create_index('ix_ajo_membership_ajo_id', 'ajo_membership', ['ajo_id'])
    op.create_index('ix_ajo_membership_user_id', 'ajo_membership', ['user_id'])
    
    # 11. Referral table
    op.create_table(
        'referral',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('referrer_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('referred_user_id', postgresql.UUID(as_uuid=False)),
        sa.Column('code', sa.String(8), nullable=False, unique=True),
        sa.Column('status', postgresql.ENUM('pending', 'completed', 'expired', name='referral_status'), nullable=False, server_default='pending'),
        sa.Column('reward_amount', sa.BigInteger(), nullable=False, server_default='500000'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['referrer_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['referred_user_id'], ['user.id'], ondelete='SET NULL'),
        sa.CheckConstraint('reward_amount > 0'),
    )
    op.create_index('ix_referral_referrer_id', 'referral', ['referrer_id'])
    op.create_index('ix_referral_code', 'referral', ['code'])
    op.create_index('ix_referral_status', 'referral', ['status'])
    
    # 12. PulseScore table
    op.create_table(
        'pulse_score',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False, unique=True),
        sa.Column('employment_signal', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('income_signal', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('repayment_signal', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ajo_signal', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('referral_signal', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fraud_signal', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.CheckConstraint('total_score >= 0 AND total_score <= 850'),
    )
    op.create_index('ix_pulse_score_user_id', 'pulse_score', ['user_id'])
    
    # 13. SquadWebhookLog table
    op.create_table(
        'squad_webhook_log',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('webhook_id', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('is_processed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_squad_webhook_log_webhook_id', 'squad_webhook_log', ['webhook_id'])
    op.create_index('ix_squad_webhook_log_event_type', 'squad_webhook_log', ['event_type'])


def downgrade() -> None:
    """Drop all tables and enum types."""
    
    # Drop tables (in reverse order of creation)
    op.drop_table('squad_webhook_log')
    op.drop_table('pulse_score')
    op.drop_table('referral')
    op.drop_table('ajo_membership')
    op.drop_table('ajo')
    op.drop_table('job')
    op.drop_table('transaction')
    op.drop_table('loan')
    op.drop_table('credit')
    op.drop_table('refresh_token')
    op.drop_table('otp')
    op.drop_table('device')
    op.drop_table('user')
    
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS referral_status")
    op.execute("DROP TYPE IF EXISTS transaction_status")
    op.execute("DROP TYPE IF EXISTS contribution_frequency")
    op.execute("DROP TYPE IF EXISTS ajo_status")
    op.execute("DROP TYPE IF EXISTS loan_status")
    op.execute("DROP TYPE IF EXISTS transaction_type")
    op.execute("DROP TYPE IF EXISTS user_status")
    op.execute("DROP TYPE IF EXISTS user_role")
