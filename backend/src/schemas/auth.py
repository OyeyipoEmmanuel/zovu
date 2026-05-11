"""
Pydantic v2 Request/Response schemas.
CRITICAL: Never expose ORM models directly — always use separate schemas.
All monetary amounts are in KOBO (integers).
"""
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List
from enum import Enum


# ============== AUTH SCHEMAS ==============
class OTPRequestSchema(BaseModel):
    """Request OTP via email."""
    email: EmailStr
    
    class Config:
        json_schema_extra = {
            "example": {"email": "user@example.com"}
        }


class OTPVerificationSchema(BaseModel):
    """Verify OTP and create account."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=8)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "code": "123456",
                "password": "SecurePassword123!"
            }
        }


class LoginSchema(BaseModel):
    """Login with email and password."""
    email: EmailStr
    password: str


class TokenResponseSchema(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenSchema(BaseModel):
    """Refresh access token."""
    refresh_token: str


class LogoutSchema(BaseModel):
    """Logout request."""
    refresh_token: str


# ============== USER SCHEMAS ==============
class UserProfileSchema(BaseModel):
    """User profile information."""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None  # Never expose encrypted value
    date_of_birth: Optional[datetime] = None
    kyc_verified: bool
    pulse_score: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserKYCSchema(BaseModel):
    """KYC submission. bvn and nin are optional individually but at least one is required."""
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)
    date_of_birth: datetime
    phone: str = Field(..., pattern=r"^\+?234\d{10}$")
    bvn: Optional[str] = Field(None, min_length=11, max_length=11)
    nin: Optional[str] = Field(None, min_length=11, max_length=11)

    @validator('nin', always=True)
    def at_least_one_id(cls, v, values):
        if not v and not values.get('bvn'):
            raise ValueError('At least one of bvn or nin is required')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "1990-01-15T00:00:00Z",
                "phone": "+2348012345678",
                "bvn": "12345678901"
            }
        }


# ============== JOB SCHEMAS ==============
class JobCreationSchema(BaseModel):
    """Create/update employment information."""
    employer_name: str = Field(..., min_length=2)
    job_title: str = Field(..., min_length=2)
    employment_type: str  # full_time | part_time | self_employed | contract
    monthly_income: int = Field(..., gt=0)  # KOBO
    employment_start_date: datetime


class JobResponseSchema(BaseModel):
    """Job information response."""
    id: str
    employer_name: str
    job_title: str
    employment_type: str
    monthly_income: int  # KOBO
    employment_duration_months: int
    verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== CREDIT SCHEMAS ==============
class CreditResponseSchema(BaseModel):
    """Credit account status."""
    available_balance: int  # KOBO
    reserved_balance: int  # KOBO
    total_balance: int  # KOBO
    max_eligible_loan: int  # KOBO (calculated from pulse score)
    status: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "available_balance": 100000,
                "reserved_balance": 50000,
                "total_balance": 150000,
                "max_eligible_loan": 500000,
                "status": "active"
            }
        }


# ============== LOAN SCHEMAS ==============
class LoanRequestSchema(BaseModel):
    """Request a loan."""
    principal_amount: int = Field(..., gt=0)  # KOBO
    tenure_days: int = Field(..., choices=[7, 14, 30, 60])


class LoanResponseSchema(BaseModel):
    """Loan details."""
    id: str
    principal_amount: int  # KOBO
    interest_amount: int  # KOBO
    total_repayment: int  # KOBO
    amount_repaid: int  # KOBO
    status: str
    tenure_days: int
    disbursal_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class LoanCalculatorSchema(BaseModel):
    """Calculate loan terms (no database mutation)."""
    principal_amount: int = Field(..., gt=0)  # KOBO
    tenure_days: int = Field(..., choices=[7, 14, 30, 60])
    
    class Config:
        json_schema_extra = {
            "example": {
                "principal_amount": 50000,
                "tenure_days": 30
            }
        }


class LoanCalculationResponseSchema(BaseModel):
    """Loan calculation result."""
    principal_amount: int  # KOBO
    interest_amount: int  # KOBO
    total_repayment: int  # KOBO
    daily_rate: float
    tenure_days: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "principal_amount": 50000,
                "interest_amount": 3000,
                "total_repayment": 53000,
                "daily_rate": 0.02,
                "tenure_days": 30
            }
        }


# ============== TRANSACTION SCHEMAS ==============
class TransactionResponseSchema(BaseModel):
    """Transaction record."""
    id: str
    sender_id: Optional[str] = None
    receiver_id: Optional[str] = None
    transaction_type: str
    amount: int  # KOBO
    status: str
    squad_reference: Optional[str] = None
    loan_id: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListSchema(BaseModel):
    """Paginated transaction list."""
    items: List[TransactionResponseSchema]
    total: int
    cursor: Optional[str] = None  # For cursor-based pagination


# ============== AJO SCHEMAS ==============
class AjoCreationSchema(BaseModel):
    """Create Ajo savings group."""
    name: str = Field(..., min_length=3)
    description: Optional[str] = None
    contribution_amount: int = Field(..., gt=0)  # KOBO
    contribution_frequency: str  # weekly | biweekly | monthly
    max_members: int = Field(..., ge=2, le=50)


class AjoResponseSchema(BaseModel):
    """Ajo group details."""
    id: str
    name: str
    description: Optional[str] = None
    contribution_amount: int  # KOBO
    contribution_frequency: str
    total_balance: int  # KOBO
    member_count: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class AjoMembershipSchema(BaseModel):
    """Ajo membership details."""
    ajo_id: str
    member_count: int
    payout_order: int
    total_contributed: int  # KOBO
    total_received: int  # KOBO
    joined_at: datetime


# ============== REFERRAL SCHEMAS ==============
class ReferralCodeSchema(BaseModel):
    """Generate referral code."""
    pass  # Empty — just endpoint trigger


class ReferralResponseSchema(BaseModel):
    """Referral information."""
    referral_code: str
    reward_amount: int  # KOBO
    referral_count: int
    active_referrals: int


# ============== PULSE SCORE SCHEMAS ==============
class PulseScoreComponentSchema(BaseModel):
    """Individual pulse score signal."""
    signal_name: str
    signal_value: int  # 0-100
    weight: float  # 0.0-1.0
    weighted_contribution: int  # (signal_value * weight)


class PulseScoreDetailSchema(BaseModel):
    """Detailed pulse score breakdown."""
    total_score: int  # 0-850
    components: List[PulseScoreComponentSchema]
    calculation_timestamp: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_score": 650,
                "components": [
                    {
                        "signal_name": "employment_stability",
                        "signal_value": 90,
                        "weight": 0.2,
                        "weighted_contribution": 18
                    }
                ],
                "calculation_timestamp": "2024-01-15T10:30:00Z"
            }
        }


# ============== ERROR SCHEMAS ==============
class ErrorSchema(BaseModel):
    """Standard error response."""
    detail: str
    
    class Config:
        json_schema_extra = {
            "example": {"detail": "Invalid request"}
        }
