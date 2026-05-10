"""
Loans router — request, calculate, check eligibility, list loans.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.core.database import get_db
from src.dependencies import get_current_user
from src.services.loan import LoanService
from src.services.credit import CreditService
from src.schemas.auth import (
    LoanRequestSchema,
    LoanResponseSchema,
    LoanCalculatorSchema,
    LoanCalculationResponseSchema,
)
from src.models import User, Loan
from src.core.exceptions import ValidationError, ConflictError
import structlog

logger = structlog.get_logger()

router = APIRouter()


@router.post(
    "/calculate",
    response_model=LoanCalculationResponseSchema,
    tags=["Loans"],
    summary="Calculate Loan Terms",
    description="Calculate loan terms (no database mutation)",
)
async def calculate_loan(
    req: LoanCalculatorSchema,
):
    """
    Calculate loan terms without creating record.
    Useful for showing user what they'll pay.
    
    - **principal_amount**: Principal in KOBO
    - **tenure_days**: 7, 14, 30, or 60 days
    """
    try:
        # Create temporary DB session just for calculation
        from src.core.database import async_session
        async with async_session() as db:
            loan_service = LoanService(db)
            return await loan_service.calculate_loan_terms(
                req.principal_amount,
                req.tenure_days,
            )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e.detail))


@router.get(
    "/eligibility",
    response_model=dict,
    tags=["Loans"],
    summary="Check Loan Eligibility",
    description="Check if user is eligible for a loan amount",
)
async def check_eligibility(
    amount: int = Query(..., gt=0, description="Requested amount in KOBO"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Check eligibility for requested loan amount.
    
    - **amount**: Requested amount in KOBO (query param)
    
    Returns eligibility status, reasons, and max eligible amount.
    """
    credit_service = CreditService(db)
    return await credit_service.check_eligibility(user.id, amount)


@router.post(
    "/request",
    response_model=dict,
    tags=["Loans"],
    summary="Request Loan",
    description="Request a loan (auto-approved if eligible)",
)
async def request_loan(
    req: LoanRequestSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Request a loan.
    Auto-approved if user is eligible.
    
    - **principal_amount**: Principal in KOBO
    - **tenure_days**: 7, 14, 30, or 60 days
    """
    try:
        loan_service = LoanService(db)
        return await loan_service.request_loan(
            user.id,
            req.principal_amount,
            req.tenure_days,
        )
    except (ValidationError, ConflictError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e.detail))
    except Exception as e:
        logger.error("loan_request_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Loan request failed")


@router.get(
    "/{loan_id}",
    response_model=dict,
    tags=["Loans"],
    summary="Get Loan Status",
    description="Get current loan status and details",
)
async def get_loan(
    loan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get loan status and details.
    
    - **loan_id**: Loan ID
    """
    try:
        # Verify ownership
        query = select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id)
        result = await db.execute(query)
        loan = result.scalar_one_or_none()
        
        if not loan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
        
        loan_service = LoanService(db)
        return await loan_service.get_loan_status(loan_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("loan_status_failed", loan_id=loan_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get loan status")


@router.get(
    "",
    response_model=dict,
    tags=["Loans"],
    summary="List User's Loans",
    description="List all loans for current user",
)
async def list_loans(
    status: str = Query(None, description="Filter by status: pending, approved, disbursed, repaying, completed, defaulted"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all loans for current user.
    
    Optional filters:
    - **status**: Loan status filter
    """
    query = select(Loan).where(Loan.user_id == user.id)
    
    if status:
        query = query.where(Loan.status == status)
    
    result = await db.execute(query)
    loans = result.scalars().all()
    
    return {
        "loans": [
            {
                "loan_id": loan.id,
                "principal_amount": loan.principal_amount,
                "interest_amount": loan.interest_amount,
                "total_repayment": loan.total_repayment,
                "amount_repaid": loan.amount_repaid,
                "status": loan.status,
                "tenure_days": loan.tenure_days,
                "due_date": loan.due_date.isoformat() if loan.due_date else None,
                "created_at": loan.created_at.isoformat(),
            }
            for loan in loans
        ],
        "total": len(loans),
    }
