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
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship
# pyrefly: ignore [missing-import]
from sqlalchemy.sql import func
from datetime import datetime, timezone
from enum import Enum
import uuid

Base = declarative_base()


# Enums
class UserRole(str, Enum):
    """User role enumeration."""
    USER = "user"
    ADMIN = "admin"


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
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), default=UserRole.USER)
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
    skills_list: Mapped[list | None] = mapped_column(JSONB)
    languages_spoken: Mapped[list | None] = mapped_column(JSONB)

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
    
    # Squad integration
    squad_virtual_account_id: Mapped[str | None] = mapped_column(String(100))
    squad_account_number: Mapped[str | None] = mapped_column(String(20))
    
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
    """Refresh tokens with family-based rotation."""
    __tablename__ = "refresh_tokens"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)  # SHA256 hash
    family_id: Mapped[str] = mapped_column(String(100))  # For rotation tracking
    device_id: Mapped[str | None] = mapped_column(String(100))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index("ix_refresh_tokens_user_id", "user_id"),
        Index("ix_refresh_tokens_family_id", "family_id"),
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
    status: Mapped[str] = mapped_column(String(50))  # pending | completed | failed
    tx_metadata: Mapped[dict | None] = mapped_column(JSON, name='metadata')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_transactions")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_transactions")
    loan = relationship("Loan", back_populates="transactions")

    # UPGRADE TRANSACTION MODEL
    amount_gross: Mapped[int | None] = mapped_column(Integer)
    squad_fee: Mapped[int | None] = mapped_column(Integer)
    method: Mapped[str | None] = mapped_column(String(50))

    economic_context: Mapped[EconomicContext | None] = mapped_column(
        SQLEnum(EconomicContext)
    )
    
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

    economic_context: Mapped[EconomicContext] = mapped_column(
        SQLEnum(EconomicContext),
        default=EconomicContext.NORMAL
    )

    amount: Mapped[int] = mapped_column(Integer)

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

    __table_args__ = (
        Index("ix_gigs_trader_id", "trader_id"),
        Index("ix_gigs_seeker_id", "seeker_id"),
        Index("ix_gigs_status", "status"),
        Index("ix_gigs_location", "location"),
    )

class Ajo(Base):
    """Ajo savings group model."""
    __tablename__ = "ajos"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    organizer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    contribution_amount: Mapped[int] = mapped_column(Integer)  # KOBO — fixed per member
    contribution_frequency: Mapped[str] = mapped_column(String(50))  # weekly | biweekly | monthly
    total_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # KOBO
    max_members: Mapped[int] = mapped_column(Integer)
    status: Mapped[AjoStatus] = mapped_column(SQLEnum(AjoStatus), default=AjoStatus.ACTIVE)
    payout_schedule: Mapped[list | None] = mapped_column(JSON)  # Array of member order
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


