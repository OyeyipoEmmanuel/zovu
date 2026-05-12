"""
Pydantic v2 Request/Response schemas.
CRITICAL: Never expose ORM models directly — always use separate schemas.
All monetary amounts are in KOBO (integers).
"""
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from datetime import datetime
from typing import Optional, List, Literal
from enum import Enum


# ============== AUTH SCHEMAS (new signup flow) ==============

class RegisterSchema(BaseModel):
    """Step-2 registration: role-first, role-specific name field required."""
    role: Literal["trader", "job_seeker", "lender"]
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str
    business_name: Optional[str] = Field(None, min_length=1)   # required if role=trader
    full_name: Optional[str] = Field(None, min_length=1)        # required if role=job_seeker
    company_name: Optional[str] = Field(None, min_length=1)     # required if role=lender

    class Config:
        json_schema_extra = {
            "example": {
                "role": "trader",
                "email": "mamatunde@test.com",
                "password": "ZovuTest@123",
                "confirm_password": "ZovuTest@123",
                "business_name": "Mama Tunde Provisions"
            }
        }


class VerifyOTPSchema(BaseModel):
    """Verify the 6-digit email OTP."""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

    class Config:
        json_schema_extra = {
            "example": {"email": "mamatunde@test.com", "otp": "123456"}
        }


class ResendOTPSchema(BaseModel):
    """Resend OTP to email (rate-limited)."""
    email: EmailStr


class LoginSchema(BaseModel):
    """Login with email and password."""
    email: EmailStr
    password: str


class UserInTokenSchema(BaseModel):
    """User object embedded inside auth responses."""
    id: str
    email: str
    role: Optional[str] = None
    display_name: str
    email_verified: bool
    profile_complete: bool
    squad_account_number: Optional[str] = None
    squad_account_bank: Optional[str] = None
    squad_provisioned: bool

    class Config:
        from_attributes = True


class AuthDataSchema(BaseModel):
    """Data payload for login / verify-otp / refresh responses."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserInTokenSchema


class RegisterDataSchema(BaseModel):
    """Data payload for the register (201) response."""
    message: str
    email: str
    otp: Optional[str] = None  # ONLY in development


# ============== LEGACY AUTH SCHEMAS (kept for KYC / existing routes) ==============

class OTPRequestSchema(BaseModel):
    """Request OTP via email."""
    email: EmailStr

    class Config:
        json_schema_extra = {
            "example": {"email": "user@example.com"}
        }


class OTPVerificationSchema(BaseModel):
    """Verify OTP and create account (legacy)."""
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


class TokenResponseSchema(BaseModel):
    """JWT token response (legacy — kept for backward compat)."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenSchema(BaseModel):
    """Refresh access token (legacy)."""
    refresh_token: str


class LogoutSchema(BaseModel):
    """Logout request (legacy)."""
    refresh_token: str


# ============== USER SCHEMAS ==============
class UserProfileSchema(BaseModel):
    """User profile information."""
    id: str
    email: str
    role: Optional[str] = None
    email_verified: bool = False
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    business_name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None  # Never expose encrypted value
    date_of_birth: Optional[datetime] = None
    kyc_verified: bool = False
    pulse_score: int = 0
    squad_account_number: Optional[str] = None
    squad_account_bank: Optional[str] = None
    squad_provisioned: bool = False
    profile_complete: bool = False
    is_banned: bool = False
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

    @model_validator(mode='after')
    def at_least_one_id(self):
        if not self.bvn and not self.nin:
            raise ValueError('At least one of bvn or nin is required')
        return self

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
    tenure_days: Literal[7, 14, 30, 60]


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
    tenure_days: Literal[7, 14, 30, 60]
    
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
    loan_id: Optional[str] = None
    transaction_type: str
    direction: str
    amount: int
    method: Optional[str] = None
    economic_context: Optional[str] = None
    squad_reference: Optional[str] = None
    status: str
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

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


# ============== ONBOARDING SCHEMAS ==============
class TraderOnboardingSchema(BaseModel):
    business_name: str = Field(..., min_length=2)
    business_type: str
    work_needed_type: str
    location: str
    primary_language: str


class SeekerOnboardingSchema(BaseModel):
    skills_list: List[str]
    languages_spoken: List[str]
    location: str
    primary_language: str


# ============== GIG SCHEMAS ==============
class GigCreationSchema(BaseModel):
    title: str
    description: Optional[str] = None
    skill_required: str
    location: str
    amount: int = Field(..., gt=0)


class GigResponseSchema(BaseModel):
    id: str
    trader_id: str
    seeker_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    skill_required: str
    location: str
    amount: int
    status: str
    trader_rating: Optional[int] = None
    seeker_rating: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============== REPUTATION SCHEMAS ==============
class ReputationSchema(BaseModel):
    trust_score: float
    punctuality_index: float
    completion_rate: float