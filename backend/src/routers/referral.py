"""
Referral router — generate code, redeem, stats.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.dependencies import get_current_user
from src.services.referral import ReferralService
from src.models import User
from src.core.exceptions import ValidationError, ConflictError
import structlog

logger = structlog.get_logger()

router = APIRouter()


@router.post(
    "/code",
    response_model=dict,
    tags=["Referral"],
    summary="Generate Referral Code",
    description="Generate unique referral code for user",
)
async def generate_code(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate or get existing referral code.
    One code per user — returns existing if valid.
    """
    try:
        referral_service = ReferralService(db)
        return await referral_service.generate_referral_code(user.id)
    except Exception as e:
        logger.error("referral_code_generation_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Code generation failed")


@router.post(
    "/redeem",
    response_model=dict,
    tags=["Referral"],
    summary="Redeem Referral Code",
    description="Redeem referral code during signup",
)
async def redeem_code(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Redeem referral code.
    Call during signup to link new user to referrer.
    
    - **code**: Referral code to redeem
    """
    try:
        referral_service = ReferralService(db)
        return await referral_service.redeem_referral_code(code, user.id)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e.detail))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e.detail))
    except Exception as e:
        logger.error("referral_redemption_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Code redemption failed")


@router.get(
    "/stats",
    response_model=dict,
    tags=["Referral"],
    summary="Get Referral Stats",
    description="Get user's referral statistics",
)
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get referral statistics for current user.
    Includes total referrals, earnings, and pending referrals.
    """
    try:
        referral_service = ReferralService(db)
        return await referral_service.get_referral_stats(user.id)
    except Exception as e:
        logger.error("referral_stats_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get stats")


@router.get(
    "/code",
    response_model=dict,
    tags=["Referral"],
    summary="Get Current Referral Code",
    description="Get user's current referral code",
)
async def get_code(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user's current referral code.
    """
    try:
        referral_service = ReferralService(db)
        return await referral_service.get_referral_code(user.id)
    except Exception as e:
        logger.error("referral_code_retrieval_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get code")
