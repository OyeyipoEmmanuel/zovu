"""
SQLAlchemy ORM models for admin dashboard.
All models use UUID primary keys and include proper indexes.
Money amounts stored in KOBO (integer).
"""
from sqlalchemy import (
    String, Integer, Boolean, DateTime, Text, JSON, ForeignKey,
    Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from src.models.base import Base


class Complaint(Base):
    """User complaints about transactions."""
    __tablename__ = "complaints"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    complainant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("transactions.id", ondelete="RESTRICT"), nullable=False)
    
    # Category: transaction_failed | payment_delayed | wrong_amount | duplicate_charge | other
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Status: new | investigating | resolved | escalated | invalid | fraud_detected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new", index=True)
    
    # Urgency: low | medium | high
    urgency: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    
    # Resolution: resolved | refund_issued | escalate_to_support | fraud_detected | invalid
    resolution: Mapped[str | None] = mapped_column(String(30), nullable=True)
    
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Squad verification
    squad_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    squad_verification_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    complainant = relationship("User", foreign_keys=[complainant_id])
    resolver = relationship("User", foreign_keys=[resolved_by])
    attachments = relationship("ComplaintAttachment", back_populates="complaint", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_complaints_complainant", "complainant_id"),
        Index("idx_complaints_status", "status"),
        Index("idx_complaints_created", "created_at"),
    )


class ComplaintAttachment(Base):
    """File attachments for complaints."""
    __tablename__ = "complaint_attachments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    complaint_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    complaint = relationship("Complaint", back_populates="attachments")


class UserFlag(Base):
    """Fraud flags on user accounts."""
    __tablename__ = "user_flags"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Flag reason: multiple_chargebacks | unusual_activity | complaint_pattern | account_takeover | device_duplication | manual_review | other
    flag_reason: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Fraud risk score: 0–100
    fraud_risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    # Flag status: active | resolved | dismissed
    flag_status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    
    # Flagged by: "system" or admin email
    flagged_by: Mapped[str] = mapped_column(String(100), nullable=False, default="system")
    
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User")

    __table_args__ = (
        Index("idx_user_flags_user", "user_id"),
        Index("idx_user_flags_score", "fraud_risk_score"),
        Index("idx_user_flags_status", "flag_status"),
        CheckConstraint("fraud_risk_score >= 0 AND fraud_risk_score <= 100"),
    )


class PartnershipRequest(Base):
    """Partnership applications from external companies."""
    __tablename__ = "partnership_requests"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Company type: lender | insurance | logistics | hmo | other
    company_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    contact_person: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    company_website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cac_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Documents: [{name: str, url: str, verified: bool}]
    documents: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    
    # Status: pending | under_review | approved | rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    reviewer = relationship("User")
    partnership = relationship("Partnership", back_populates="request", uselist=False)

    __table_args__ = (
        Index("idx_partnership_requests_status", "status"),
        Index("idx_partnership_requests_type", "company_type"),
    )


class Partnership(Base):
    """Active partnerships on platform."""
    __tablename__ = "partnerships"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("partnership_requests.id", ondelete="SET NULL"), nullable=True)
    
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_type: Mapped[str] = mapped_column(String(50), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Services: [service description strings]
    services: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    
    # Terms: {} for terms data
    terms: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    
    # Status: active | suspended | archived
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=999)
    
    # Metrics: {customers_served: int, total_disbursed_kobo: int, avg_rating: float}
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    request = relationship("PartnershipRequest", back_populates="partnership")

    __table_args__ = (
        Index("idx_partnerships_status", "status"),
        Index("idx_partnerships_display", "featured", "display_order"),
    )


class AdminAuditLog(Base):
    """Audit log of all admin actions."""
    __tablename__ = "admin_audit_log"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    admin_email: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Action: e.g. "complaint.resolved", "user.paused", "partnership.approved"
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    # Target type: e.g. "complaint", "user", "partnership"
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Target ID
    target_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    
    # State diffs
    before_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    # Relationships
    admin = relationship("User")

    __table_args__ = (
        Index("idx_audit_admin", "admin_id"),
        Index("idx_audit_created", "created_at"),
        Index("idx_audit_action", "action"),
    )
