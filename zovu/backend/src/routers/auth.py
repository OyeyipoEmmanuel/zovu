"""
Authentication router — OTP request, registration, login, refresh, logout, profile, KYC.
All endpoints use dependency injection for security and type safety.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from src.core.database import get_db
from src.core.redis_client import get_redis_blacklist_dep
from src.dependencies import get_current_user, get_optional_user
from src.services.auth import AuthService
from src.services.fraud import FraudService
from src.schemas.auth import (
    OTPRequestSchema,
    OTPVerificationSchema,
    LoginSchema,
    TokenResponseSchema,
    RefreshTokenSchema,
    LogoutSchema,
    UserProfileSchema,
    UserKYCSchema,
)
from src.models import User
from src.core.exceptions import ValidationError
import structlog

logger = structlog.get_logger()

router = APIRouter()


@router.post(
    "/request-otp",
    response_model=dict,
    tags=["Auth"],
    summary="Request OTP",
    description="Send OTP to email for login or registration",
)
async def request_otp(
    req: OTPRequestSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    """
    Request OTP via email.
    Used for both login (existing user) and registration (new user).
    
    - **email**: User email address
    """
    try:
        auth_service = AuthService(db, redis)
        result = await auth_service.send_otp(req.email)
        return result
    except Exception as e:
        logger.error("otp_request_failed", email=req.email, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="OTP request failed")


@router.post(
    "/verify-otp",
    response_model=TokenResponseSchema,
    tags=["Auth"],
    summary="Verify OTP and Register/Login",
    description="Verify OTP code and create account or login",
)
async def verify_otp(
    req: OTPVerificationSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    """
    Verify OTP and complete registration or login.
    
    - **email**: User email
    - **code**: 6-digit OTP
    - **password**: New password (8+ chars)
    """
    try:
        auth_service = AuthService(db, redis)
        tokens = await auth_service.verify_otp_and_register(
            email=req.email,
            otp_code=req.code,
            password=req.password,
        )
        return tokens
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e.detail))
    except Exception as e:
        logger.error("otp_verification_failed", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="OTP verification failed")


@router.post(
    "/login",
    response_model=TokenResponseSchema,
    tags=["Auth"],
    summary="Login",
    description="Login with email and password",
)
async def login(
    req: LoginSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    """
    Login with email and password.
    Returns access token (15min) and refresh token (7 days).
    
    - **email**: User email
    - **password**: User password
    """
    try:
        auth_service = AuthService(db, redis)
        tokens = await auth_service.login(email=req.email, password=req.password)
        return tokens
    except Exception as e:
        logger.error("login_failed", email=req.email, error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@router.post(
    "/refresh",
    response_model=TokenResponseSchema,
    tags=["Auth"],
    summary="Refresh Access Token",
    description="Get new access token using refresh token (family-based rotation)",
)
async def refresh_token(
    req: RefreshTokenSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    """
    Refresh access token using refresh token.
    Implements family-based rotation for enhanced security.
    
    - **refresh_token**: JWT refresh token from login
    """
    try:
        auth_service = AuthService(db, redis)
        tokens = await auth_service.refresh_access_token(req.refresh_token)
        return tokens
    except Exception as e:
        logger.error("refresh_token_failed", error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")


@router.post(
    "/logout",
    response_model=dict,
    tags=["Auth"],
    summary="Logout",
    description="Logout and revoke all tokens",
)
async def logout(
    req: LogoutSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    """
    Logout user and revoke all tokens in family.
    
    - **refresh_token**: Refresh token to revoke
    """
    try:
        auth_service = AuthService(db, redis)
        result = await auth_service.logout(user_id=user.id, refresh_token=req.refresh_token)
        return result
    except Exception as e:
        logger.error("logout_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Logout failed")


@router.get(
    "/me",
    response_model=UserProfileSchema,
    tags=["Auth"],
    summary="Get Profile",
    description="Get current user profile",
)
async def get_profile(
    user: User = Depends(get_current_user),
):
    """
    Get current authenticated user's profile.
    Requires valid access token.
    """
    return UserProfileSchema.from_orm(user)


@router.post(
    "/kyc",
    response_model=dict,
    tags=["Auth"],
    summary="Submit KYC",
    description="Submit KYC documents for verification",
)
async def submit_kyc(
    req: UserKYCSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit KYC documents (personal info, BVN, NIN).
    Triggers background verification.
    
    - **first_name**: First name
    - **last_name**: Last name
    - **date_of_birth**: Date of birth
    - **phone**: Phone number (+234...)
    - **bvn**: Bank Verification Number
    - **nin**: National ID Number
    """
    try:
        from src.core.security import encrypt_pii
        
        # Encrypt PII fields
        phone_encrypted = encrypt_pii(req.phone)
        bvn_encrypted = encrypt_pii(req.bvn) if req.bvn else None
        nin_encrypted = encrypt_pii(req.nin) if req.nin else None
        
        # Update user
        user.first_name = req.first_name
        user.last_name = req.last_name
        user.date_of_birth = req.date_of_birth
        user.phone = phone_encrypted
        user.bvn = bvn_encrypted
        user.nin = nin_encrypted
        
        await db.commit()
        
        # Trigger async KYC verification (Celery task)
        from src.workers.fraud_tasks import verify_kyc_documents
        verify_kyc_documents.delay(user.id, req.bvn, req.nin)
        
        logger.info("kyc_submission_received", user_id=user.id)
        
        return {
            "status": "submitted",
            "message": "KYC documents submitted. Verification in progress.",
            "user_id": user.id,
        }
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e.detail))
    except Exception as e:
        logger.error("kyc_submission_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="KYC submission failed")
