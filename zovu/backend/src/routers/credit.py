"""
Credit router — check available balance, max eligible loan.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.dependencies import get_current_user
from src.services.credit import CreditService
from src.schemas.auth import CreditResponseSchema
from src.models import User
import structlog

logger = structlog.get_logger()

router = APIRouter()


@router.get(
    "/status",
    response_model=CreditResponseSchema,
    tags=["Credit"],
    summary="Check Credit Status",
    description="Get available balance and max eligible loan",
)
async def get_credit_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get credit account status.
    
    Returns:
    - **available_balance**: Available credit balance (KOBO)
    - **reserved_balance**: Reserved for pending loans (KOBO)
    - **total_balance**: Total balance (KOBO)
    - **max_eligible_loan**: Maximum eligible loan based on pulse score (KOBO)
    - **status**: Account status (active/suspended)
    """
    credit_service = CreditService(db)
    return await credit_service.get_credit_status(user.id)


@router.post(
    "/deposit",
    response_model=dict,
    tags=["Credit"],
    summary="Deposit Credit",
    description="Deposit credit (internal use - Squad webhook)",
)
async def deposit_credit(
    amount: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deposit credit to account.
    Amount in KOBO.
    
    **Internal use**: Called from Squad webhook or admin operations.
    """
    credit_service = CreditService(db)
    return await credit_service.deposit_credit(user.id, amount)
