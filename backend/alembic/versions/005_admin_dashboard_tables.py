"""Admin dashboard schema: complaints, fraud, partnerships, audit logs

Revision ID: 005_admin_dashboard_tables
Revises: 004_gig_applications_lender_unlocks_job_recommendations
Create Date: 2026-05-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Revision identifiers
revision = '005_admin_dashboard_tables'
down_revision = '004_gig_applications_lender_unlocks_job_recommendations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create admin dashboard tables."""
    
    # Add deleted_at column to users table (for account deletion tracking)
    op.add_column(
        'users',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True)
    )
    
    # 1. complaints table
    op.create_table(
        'complaints',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('complainant_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='new'),
        sa.Column('urgency', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('resolution', sa.String(30), nullable=True),
        sa.Column('admin_notes', sa.Text, nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('squad_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('squad_verification_result', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['complainant_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_complaints_complainant', 'complaints', ['complainant_id'])
    op.create_index('idx_complaints_status', 'complaints', ['status'])
    op.create_index('idx_complaints_created', 'complaints', ['created_at'], postgresql_ops={'created_at': 'DESC'})
    
    # 2. complaint_attachments table
    op.create_table(
        'complaint_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('complaint_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_size_kb', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['complaint_id'], ['complaints.id'], ondelete='CASCADE'),
    )
    
    # 3. user_flags table
    op.create_table(
        'user_flags',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('flag_reason', sa.String(50), nullable=False),
        sa.Column('fraud_risk_score', sa.Integer, nullable=False, server_default='0'),
        sa.Column('flag_status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('flagged_by', sa.String(100), nullable=False, server_default='system'),
        sa.Column('admin_notes', sa.Text, nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_user_flags_user', 'user_flags', ['user_id'])
    op.create_index('idx_user_flags_score', 'user_flags', ['fraud_risk_score'], postgresql_ops={'fraud_risk_score': 'DESC'})
    op.create_index('idx_user_flags_status', 'user_flags', ['flag_status'])
    
    # 4. partnership_requests table
    op.create_table(
        'partnership_requests',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('company_name', sa.String(255), nullable=False),
        sa.Column('company_type', sa.String(50), nullable=False),
        sa.Column('contact_person', sa.String(255), nullable=False),
        sa.Column('contact_email', sa.String(255), nullable=False),
        sa.Column('contact_phone', sa.String(20), nullable=True),
        sa.Column('company_website', sa.String(500), nullable=True),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('cac_number', sa.String(50), nullable=True),
        sa.Column('documents', postgresql.JSON, nullable=False, server_default='[]'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('admin_notes', sa.Text, nullable=True),
        sa.Column('rejection_reason', sa.Text, nullable=True),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_partnership_requests_status', 'partnership_requests', ['status'])
    op.create_index('idx_partnership_requests_type', 'partnership_requests', ['company_type'])
    
    # 5. partnerships table
    op.create_table(
        'partnerships',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('request_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('company_name', sa.String(255), nullable=False),
        sa.Column('company_type', sa.String(50), nullable=False),
        sa.Column('contact_email', sa.String(255), nullable=False),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('services', postgresql.JSON, nullable=False, server_default='[]'),
        sa.Column('terms', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('featured', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('display_order', sa.Integer, nullable=False, server_default='999'),
        sa.Column('metrics', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['request_id'], ['partnership_requests.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_partnerships_status', 'partnerships', ['status'])
    op.create_index('idx_partnerships_display', 'partnerships', ['featured', 'display_order'], postgresql_ops={'featured': 'DESC', 'display_order': 'ASC'})
    
    # 6. admin_audit_log table
    op.create_table(
        'admin_audit_log',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('admin_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('admin_email', sa.String(255), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('before_state', postgresql.JSON, nullable=True),
        sa.Column('after_state', postgresql.JSON, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id']),
    )
    op.create_index('idx_audit_admin', 'admin_audit_log', ['admin_id'])
    op.create_index('idx_audit_created', 'admin_audit_log', ['created_at'], postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_audit_action', 'admin_audit_log', ['action'])


def downgrade() -> None:
    """Revert admin dashboard tables."""
    
    # Drop tables in reverse order
    op.drop_table('admin_audit_log')
    op.drop_table('partnerships')
    op.drop_table('partnership_requests')
    op.drop_table('user_flags')
    op.drop_table('complaint_attachments')
    op.drop_table('complaints')
    
    # Drop deleted_at column from users
    op.drop_column('users', 'deleted_at')
