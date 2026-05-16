"""
SQLAlchemy ORM models with async support.
All models use UUID primary keys and include proper indexes.
Money amounts are ALWAYS stored in KOBO (integer) — never floats.
"""
# pyrefly: ignore [missing-import]
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, JSON, Enum as SQLEnum,
    ForeignKey, UniqueConstraint, Index, CheckConstraint, LargeBinary
)

# pyrefly: ignore [missing-import]
from sqlalchemy.dialects.postgresql import UUID, ARRAY
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship
# pyrefly: ignore [missing-import]
from sqlalchemy.sql import func
from datetime import datetime, timezone
from enum import Enum
import uuid

Base = declarative_base()


# Enums
class UserType(str, Enum):
    TRADER = "trader"
    SEEKER = "seeker"
    BOTH = "both"


class UserStatus(str, Enum):
    """User status — note: NO DELETE, only soft-freeze."""
    ACTIVE = "active"
    SOFT_FROZEN = "frozen"  # Soft freeze (no action) vs deleted


class TransactionType(str, Enum):
    """Transaction types."""
    CREDIT_DEPOSIT = "credit_deposit"
    CREDIT_WITHDRAWAL = "credit_withdrawal"
    LOAN_DISBURSEMENT = "loan_disbursement"
    LOAN_REPAYMENT = "loan_repayment"
    AJO_CONTRIBUTION = "ajo_contribution"
    AJO_PAYOUT = "ajo_payout"


class LoanStatus(str, Enum):
    """Loan status."""
    PENDING = "pending"
    APPROVED = "approved"
    DISBURSED = "disbursed"
    REPAYING = "repaying"
    COMPLETED = "completed"
    DEFAULTED = "defaulted"


class AjoStatus(str, Enum):
    """Ajo (savings group) status."""
    ACTIVE = "active"
    CLOSED = "closed"


# new set of enums for market place and gigs

class BusinessType(str, Enum):
    WHOLESALER = "wholesaler"
    RETAILER = "retailer"
    SMALL_KIOSK = "small_kiosk"
    ONLINE_VENDOR = "online_vendor"
    SERVICE_PROVIDER = "service_provider"


class EmploymentType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    SELF_EMPLOYED = "self_employed"
    CONTRACT = "contract"

class EconomicContext(str, Enum):
    NORMAL = "normal"
    HOLIDAY_RUSH = "holiday_rush"
    RAINY_DAY = "rainy_day"
    FUEL_SCARCITY = "fuel_scarcity"
    MARKET_STRIKE = "market_strike"


class ShieldStatus(str, Enum):
    NONE = "none"
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"


class GigStatus(str, Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class WorkNeededType(str, Enum):
    DELIVERY = "delivery"
    SALES = "sales"
    LOGISTICS = "logistics"
    CLEANING = "cleaning"
    DIGITAL = "digital"
    SECURITY = "security"


# Models
class User(Base):
    """User account model."""
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone: Mapped[bytes]  # Encrypted with Fernet
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    user_type: Mapped[UserType] = mapped_column(
        SQLEnum(UserType),
        default=UserType.SEEKER
    )
    status: Mapped[UserStatus] = mapped_column(SQLEnum(UserStatus), default=UserStatus.ACTIVE)
    
    # KYC fields (encrypted)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    date_of_birth: Mapped[datetime | None]
    bvn: Mapped[bytes | None]  # Encrypted
    nin: Mapped[bytes | None]  # Encrypted
    
    # Profile
    profile_photo_url: Mapped[str | None] = mapped_column(String(500))
    bio: Mapped[str | None] = mapped_column(Text)
    
    # i added this for the users who want to trade
    # Marketplace identity
    business_name: Mapped[str | None] = mapped_column(String(255))
    business_type: Mapped[BusinessType | None] = mapped_column(SQLEnum(BusinessType))
    work_needed_type: Mapped[WorkNeededType | None] = mapped_column(SQLEnum(WorkNeededType))
    location: Mapped[str | None] = mapped_column(String(255))
    primary_language: Mapped[str | None] = mapped_column(String(50))

    # Seeker profile
    skills_list: Mapped[list | None] = mapped_column(JSON)
    languages_spoken: Mapped[list | None] = mapped_column(JSON)

    # Behavioral scoring
    sales_consistency: Mapped[float] = mapped_column(Float, default=0.0)
    ajo_discipline: Mapped[float] = mapped_column(Float, default=0.0)
    repayment_punctuality: Mapped[float] = mapped_column(Float, default=0.0)
    trust_score: Mapped[float] = mapped_column(Float, default=0.0)
    punctuality_index: Mapped[float] = mapped_column(Float, default=0.0)
    completion_rate: Mapped[float] = mapped_column(Float, default=0.0)

    # Revenue analytics
    average_daily_revenue: Mapped[int] = mapped_column(Integer, default=0)
    average_monthly_revenue: Mapped[int] = mapped_column(Integer, default=0)
    total_earned_to_date: Mapped[int] = mapped_column(Integer, default=0)

    # Credit analytics
    max_credit_limit: Mapped[int] = mapped_column(Integer, default=0)
    current_debt_balance: Mapped[int] = mapped_column(Integer, default=0)
    max_advance_limit: Mapped[int] = mapped_column(Integer, default=0)

    # Savings
    ajo_savings_balance: Mapped[int] = mapped_column(Integer, default=0)
    auto_save_pct: Mapped[float] = mapped_column(Float, default=0.0)

    # Protection
    shield_status: Mapped[ShieldStatus] = mapped_column(
        SQLEnum(ShieldStatus),
        default=ShieldStatus.NONE
    )

    # ADD GIG RELATIONSHIPS TO USER MODEL
    gigs_created = relationship(
        "Gig",
        foreign_keys="Gig.trader_id"
    )


    gigs_taken = relationship(
        "Gig",
        foreign_keys="Gig.seeker_id"
    )

    # Compliance
    kyc_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    compliance_flags: Mapped[list | None] = mapped_column(JSON)  # Array of compliance issues
    
    # Pulse Score (aggregate from signals)
    pulse_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # 0-850
    
    # New signup-flow fields
    role: Mapped[str | None] = mapped_column(String(20))  # trader | job_seeker | lender
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    full_name: Mapped[str | None] = mapped_column(String(255))   # job_seeker
    company_name: Mapped[str | None] = mapped_column(String(255))  # lender
    profile_complete: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    ban_reason: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Lender/partner approval gate — set true after admin approves
    partner_approved: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    partner_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Squad integration
    squad_account_id: Mapped[str | None] = mapped_column(String(100))  # from Squad response
    squad_account_number: Mapped[str | None] = mapped_column(String(20))
    squad_account_bank: Mapped[str | None] = mapped_column(String(100))
    squad_provisioned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    credits = relationship("Credit", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    sent_transactions = relationship("Transaction", foreign_keys="Transaction.sender_id", back_populates="sender")
    received_transactions = relationship("Transaction", foreign_keys="Transaction.receiver_id", back_populates="receiver")
    referrals_given = relationship("Referral", foreign_keys="Referral.referrer_id", back_populates="referrer")
    referrals_received = relationship("Referral", foreign_keys="Referral.referred_id", back_populates="referred_user")
    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
    ajo_memberships = relationship("AjoMembership", back_populates="user", cascade="all, delete-orphan")
    pulse_scores = relationship("PulseScore", back_populates="user", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_status", "status"),
        Index("ix_users_pulse_score", "pulse_score"),
        CheckConstraint("pulse_score >= 0 AND pulse_score <= 850"),
    )


class Device(Base):
    """Device fingerprint for fraud detection."""
    __tablename__ = "devices"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    fingerprint: Mapped[str] = mapped_column(String(500), unique=True)
    device_name: Mapped[str | None] = mapped_column(String(255))
    user_agent: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str] = mapped_column(String(50))
    is_trusted: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="devices")
    
    __table_args__ = (
        Index("ix_devices_user_id", "user_id"),
        Index("ix_devices_fingerprint", "fingerprint"),
    )


class OTP(Base):
    """One-time passwords for authentication."""
    __tablename__ = "otps"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    code_hash: Mapped[str] = mapped_column(String(255))  # SHA256 hash
    purpose: Mapped[str] = mapped_column(String(50))  # 'login', 'kyc_verification'
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index("ix_otps_user_id", "user_id"),
        Index("ix_otps_expires_at", "expires_at"),
    )


class RefreshToken(Base):
    """Refresh tokens with family-based rotation and theft detection."""
    __tablename__ = "refresh_tokens"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)  # SHA256 hash
    family_id: Mapped[str] = mapped_column(String(100))  # For rotation tracking
    device_id: Mapped[str | None] = mapped_column(String(100))
    device_fingerprint: Mapped[str | None] = mapped_column(String(500))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # set on rotation; if set = token was already consumed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index("ix_refresh_tokens_user_id", "user_id"),
        Index("ix_refresh_tokens_family_id", "family_id"),
        Index("ix_refresh_tokens_token_hash", "token_hash"),
    )


class Credit(Base):
    """Credit account — pull-based scoring."""
    __tablename__ = "credits"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    available_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO
    reserved_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO (pending loans)
    total_withdrawn: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO (lifetime)
    status: Mapped[str] = mapped_column(String(50), default="active")  # active | suspended
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="credits")
    
    __table_args__ = (
        Index("ix_credits_user_id", "user_id"),
        CheckConstraint("available_balance >= 0"),
        CheckConstraint("reserved_balance >= 0"),
    )


class Loan(Base):
    """Loan model — auto-approved based on pulse score."""
    __tablename__ = "loans"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    principal_amount: Mapped[int] = mapped_column(Integer)  # KOBO
    interest_amount: Mapped[int] = mapped_column(Integer)  # KOBO
    total_repayment: Mapped[int] = mapped_column(Integer)  # KOBO (principal + interest)
    amount_repaid: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO
    status: Mapped[LoanStatus] = mapped_column(SQLEnum(LoanStatus), default=LoanStatus.PENDING)
    tenure_days: Mapped[int] = mapped_column(Integer)  # 7, 14, 30, 60
    disbursal_date: Mapped[datetime | None]
    due_date: Mapped[datetime | None]
    squad_transaction_id: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="loans")
    transactions = relationship("Transaction", back_populates="loan")
    
    __table_args__ = (
        Index("ix_loans_user_id", "user_id"),
        Index("ix_loans_status", "status"),
        Index("ix_loans_due_date", "due_date"),
        CheckConstraint("principal_amount > 0"),
        CheckConstraint("amount_repaid >= 0"),
    )


class Transaction(Base):
    """Transaction ledger — all money movements.
    
    sender_id: the user initiating/paying (NULL when money comes from an external source or system).
    receiver_id: the user receiving funds (NULL when money goes to an external destination or system).
    At least one of sender_id / receiver_id must reference a User row.
    """
    __tablename__ = "transactions"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    receiver_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    loan_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("loans.id", ondelete="SET NULL"))
    transaction_type: Mapped[TransactionType] = mapped_column(SQLEnum(TransactionType))
    amount: Mapped[int] = mapped_column(Integer)  # KOBO
    squad_reference: Mapped[str | None] = mapped_column(String(100))

    direction: Mapped[str] = mapped_column(String(20))  # credit | debit

    # Extended fields (added for marketplace/seeder compatibility)
    amount_gross: Mapped[int | None] = mapped_column(Integer)   # KOBO (before fee)
    squad_fee: Mapped[int | None] = mapped_column(Integer)       # KOBO
    method: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50))  # pending | completed | failed
    tx_metadata: Mapped[dict | None] = mapped_column(JSON, name='metadata')
    economic_context: Mapped[EconomicContext | None] = mapped_column(SQLEnum(EconomicContext))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_transactions")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_transactions")
    loan = relationship("Loan", back_populates="transactions")

    __table_args__ = (
        Index("ix_transactions_sender_id", "sender_id"),
        Index("ix_transactions_receiver_id", "receiver_id"),
        Index("ix_transactions_created_at", "created_at"),
        Index("ix_transactions_squad_reference", "squad_reference"),
    )


class Job(Base):
    """Employment data for pulse score calculation."""
    __tablename__ = "jobs"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    employer_name: Mapped[str] = mapped_column(String(255))
    job_title: Mapped[str] = mapped_column(String(255))
    employment_type: Mapped[str] = mapped_column(String(50))  # full_time | part_time | self_employed | contract
    monthly_income: Mapped[int] = mapped_column(Integer)  # KOBO
    employment_start_date: Mapped[datetime]
    employment_duration_months: Mapped[int]  # Cached calculation
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="jobs")
    
    __table_args__ = (
        Index("ix_jobs_user_id", "user_id"),
    )

# the gig class i just added
class Gig(Base):
    """Marketplace gigs between traders and seekers."""

    __tablename__ = "gigs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    trader_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE")
    )

    seeker_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL")
    )

    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)

    skill_required: Mapped[str] = mapped_column(String(255))

    location: Mapped[str] = mapped_column(String(255))
    # Street-level / on-site address used by job seekers on the day; surfaced in
    # the in-app job note and copied into the trader-contact reminder when the
    # seeker arrives.
    direct_location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # When the trader expects the seeker to start (used for punctuality
    # signals in pulse-score calculation and for the "arrived on time" check).
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    economic_context: Mapped[EconomicContext] = mapped_column(
        SQLEnum(EconomicContext),
        default=EconomicContext.NORMAL
    )

    amount: Mapped[int] = mapped_column(Integer)
    payment_period: Mapped[str | None] = mapped_column(String(50))  # One-off | Daily | Weekly | Monthly

    status: Mapped[GigStatus] = mapped_column(
        SQLEnum(GigStatus),
        default=GigStatus.OPEN
    )

    trader_rating: Mapped[int | None] = mapped_column(Integer)
    seeker_rating: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    accepted_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]
    cancelled_at: Mapped[datetime | None]

    __table_args__ = (
        Index("ix_gigs_trader_id", "trader_id"),
        Index("ix_gigs_seeker_id", "seeker_id"),
        Index("ix_gigs_status", "status"),
        Index("ix_gigs_location", "location"),
    )


class GigApplication(Base):
    """Application by a job seeker to a gig.

    `status` is governed by the escrow state machine — see
    alembic/versions/010_job_escrow_state_machine.py for the value list and
    transitions. Money is reserved against the trader on accept and only
    released by trader_confirmed (or admin via the support ticket route).
    """
    __tablename__ = "gig_applications"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    gig_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("gigs.id", ondelete="CASCADE"))
    seeker_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    # Kobo amount reserved off the trader when this application is accepted.
    # Held until trader_confirmed (payout) or admin resolution.
    reserved_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Set when the seeker marks the job done.
    worker_done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # worker_done_at + 24h — the trader has until this point to confirm or
    # dispute, otherwise the Celery deadline task escalates to in_dispute.
    confirmation_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Celery task id for the deadline check, so a trader_confirmed transition
    # can revoke the scheduled task.
    celery_deadline_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Free-text note attached to the application — used by Task 9 to surface
    # the trader's phone number to a nearby seeker.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("gig_id", "seeker_id", name="uq_gig_seeker_application"),
        Index("ix_gig_applications_gig_id", "gig_id"),
        Index("ix_gig_applications_seeker_id", "seeker_id"),
        Index("ix_gig_applications_status", "status"),
    )


class SupportTicket(Base):
    """Support queue item for job escrow timeouts and manual resolutions."""
    __tablename__ = "support_tickets"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    reference_id: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", server_default="open", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_support_tickets_type", "type"),
        Index("ix_support_tickets_reference_id", "reference_id"),
        Index("ix_support_tickets_status", "status"),
    )


class LenderUnlock(Base):
    """Tracks when a lender has unlocked a borrower's full profile."""
    __tablename__ = "lender_unlocks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    lender_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    borrower_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("lender_id", "borrower_id", name="uq_lender_borrower_unlock"),
        Index("ix_lender_unlocks_lender_id", "lender_id"),
        Index("ix_lender_unlocks_borrower_id", "borrower_id"),
    )


class JobRecommendation(Base):
    """AI-matched job recommendation for a seeker, created when a gig is posted."""
    __tablename__ = "job_recommendations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    seeker_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    gig_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("gigs.id", ondelete="CASCADE"), nullable=False)
    synergy_score: Mapped[float] = mapped_column(Float, default=0.0)
    match_tags: Mapped[list | None] = mapped_column(JSON, default=list)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    viewed: Mapped[bool] = mapped_column(Boolean, default=False)
    applied: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("seeker_id", "gig_id", name="uq_seeker_gig_recommendation"),
        Index("ix_job_recommendations_seeker_id", "seeker_id"),
        Index("ix_job_recommendations_gig_id", "gig_id"),
    )


class Ajo(Base):
    """Ajo savings group model."""
    __tablename__ = "ajos"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    organizer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    contribution_amount: Mapped[int] = mapped_column(Integer)  # KOBO — minimum deposit per member
    contribution_frequency: Mapped[str] = mapped_column(String(50))  # weekly | biweekly | monthly
    total_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO
    max_members: Mapped[int] = mapped_column(Integer)
    status: Mapped[AjoStatus] = mapped_column(SQLEnum(AjoStatus), default=AjoStatus.ACTIVE)
    payout_schedule: Mapped[list | None] = mapped_column(JSON)  # Array of member order
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Optional admin-managed due date for the *next* contribution cycle. Used
    # by the webhook reconciler to flag a contribution on_time/late.
    next_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merchant_squad_account: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("ix_ajos_organizer_id", "organizer_id"),
        Index("ix_ajos_status", "status"),
    )


class AjoMembership(Base):
    """Ajo group membership."""
    __tablename__ = "ajo_memberships"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    ajo_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("ajos.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    payout_order: Mapped[int]  # Order in rotation
    total_contributed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO
    total_received: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="ajo_memberships")
    
    __table_args__ = (
        UniqueConstraint("ajo_id", "user_id", name="ix_ajo_membership_unique"),
        Index("ix_ajo_memberships_user_id", "user_id"),
    )


class Referral(Base):
    """Referral tracking for rewards."""
    __tablename__ = "referrals"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    referrer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    referred_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    referral_code: Mapped[str] = mapped_column(String(50), unique=True)
    status: Mapped[str] = mapped_column(String(50))  # pending | completed | expired
    reward_amount: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO
    reward_credited: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    credited_at: Mapped[datetime | None]
    expires_at: Mapped[datetime]
    
    referrer = relationship("User", foreign_keys=[referrer_id], back_populates="referrals_given")
    referred_user = relationship("User", foreign_keys=[referred_id], back_populates="referrals_received")
    
    __table_args__ = (
        Index("ix_referrals_referrer_id", "referrer_id"),
        Index("ix_referrals_referred_id", "referred_id"),
        Index("ix_referrals_status", "status"),
    )


class PulseScore(Base):
    """Pulse score signals and calculation history."""
    __tablename__ = "pulse_scores"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    
    # 6 weighted signals (all 0-100 scale before weighting)
    employment_stability_signal: Mapped[int] = mapped_column(Integer)  # weight=0.20
    income_score_signal: Mapped[int] = mapped_column(Integer)  # weight=0.20
    repayment_history_signal: Mapped[int] = mapped_column(Integer)  # weight=0.25
    ajo_participation_signal: Mapped[int] = mapped_column(Integer)  # weight=0.15
    referral_quality_signal: Mapped[int] = mapped_column(Integer)  # weight=0.10
    fraud_risk_signal: Mapped[int] = mapped_column(Integer)  # weight=0.10 (inverted)
    
    total_score: Mapped[int] = mapped_column(Integer)  # 0-850
    calculation_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="pulse_scores")
    
    __table_args__ = (
        Index("ix_pulse_scores_user_id", "user_id"),
        Index("ix_pulse_scores_calculation_timestamp", "calculation_timestamp"),
    )


class LenderServiceOffering(Base):
    """A product (loan / insurance / savings) offered by a lender/partner."""
    __tablename__ = "lender_service_offerings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    lender_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # loan | insurance | savings
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_pulse_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    max_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)  # KOBO
    interest_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    premium_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)  # KOBO
    repayment_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")  # active | archived
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_lender_service_offerings_lender_id", "lender_id"),
        Index("ix_lender_service_offerings_type", "type"),
    )


class AjoTransaction(Base):
    """Per-Ajo-group transaction record (admin + user dashboard history)."""
    __tablename__ = "ajo_transactions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    ajo_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("ajos.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # KOBO
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # contribution | payout
    status: Mapped[str] = mapped_column(String(20), default="completed", server_default="completed")
    squad_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # paid_at is null until the Squad webhook confirms the inbound payment.
    # on_time is set at the same time, comparing paid_at to ajos.next_due_date
    # (falling back to ajos.end_date when next_due_date is null).
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    on_time: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_ajo_transactions_ajo_id", "ajo_id"),
        Index("ix_ajo_transactions_user_id", "user_id"),
    )


class Review(Base):
    """Bi-directional rating + review between trader and seeker for a completed gig.

    Visible to all users on the platform. One row per (reviewer, reviewee, gig)
    so each side can leave one review per gig.
    """
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    reviewer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    reviewee_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    gig_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("gigs.id", ondelete="SET NULL"), nullable=True)
    rating: Mapped[int] = mapped_column(Integer)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_role: Mapped[str] = mapped_column(String(20))  # "trader" or "seeker" — speeds up filtering
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("reviewer_id", "reviewee_id", "gig_id", name="uq_review_per_gig"),
        Index("ix_reviews_reviewee_id", "reviewee_id"),
        Index("ix_reviews_reviewer_id", "reviewer_id"),
        Index("ix_reviews_gig_id", "gig_id"),
        CheckConstraint("rating >= 1 AND rating <= 5"),
    )


class SquadWebhookLog(Base):
    """Squad webhook request logging for idempotency."""
    __tablename__ = "squad_webhook_logs"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    webhook_id: Mapped[str] = mapped_column(String(100), unique=True)  # From Squad
    event_type: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSON)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index("ix_squad_webhook_logs_webhook_id", "webhook_id"),
    )


