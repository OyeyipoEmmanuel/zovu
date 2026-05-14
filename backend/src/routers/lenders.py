"""
Lenders router — profile, customers, loans, stats, performance.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.core.database import get_db
from src.dependencies import get_current_user
from src.models import User
from src.services.LenderService import LenderService
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/lenders", tags=["Lenders"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class UnlockCustomerRequest(BaseModel):
    borrower_id: str


# ── Stats / Performance ───────────────────────────────────────────────────────

@router.get("/stats", response_model=dict, summary="Lender aggregate stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return aggregate lending KPIs for the authenticated lender."""
    svc = LenderService(db)
    stats = await svc.get_stats(user)
    return {"ok": True, "data": stats}


@router.get("/performance", response_model=dict, summary="Lender repayment performance")
async def get_performance(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = LenderService(db)
    perf = await svc.get_performance(user)
    return {"ok": True, "data": perf}


# ── Customers ─────────────────────────────────────────────────────────────────

@router.get("/customers", response_model=dict, summary="List anonymised borrowers")
async def get_customers(
    min_score: int | None = Query(None),
    tier: str | None = Query(None),
    lga: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return anonymised borrower list. Unlocked profiles show full names."""
    svc = LenderService(db)
    filters = {"min_score": min_score, "tier": tier, "lga": lga, "limit": limit}
    customers = await svc.get_customers(user, {k: v for k, v in filters.items() if v is not None})
    return {"ok": True, "data": customers}


@router.get("/customers/{borrower_id}", response_model=dict, summary="Get borrower profile")
async def get_customer(
    borrower_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Full profile if already unlocked, otherwise anonymised."""
    svc = LenderService(db)
    customer = await svc.get_customer_by_id(user, borrower_id)
    return {"ok": True, "data": customer}


@router.post("/customers/unlock", response_model=dict, summary="Unlock borrower profile")
async def unlock_customer(
    payload: UnlockCustomerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Unlock full borrower name and email. Logged in lender_unlocks table."""
    svc = LenderService(db)
    async with db.begin_nested():
        profile = await svc.unlock_customer(user, payload.borrower_id)
    await db.commit()
    return {"ok": True, "data": profile}


# ── Loans ─────────────────────────────────────────────────────────────────────

@router.get("/loans", response_model=dict, summary="List lender's disbursed loans")
async def get_loans(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all loans disbursed by this lender, optionally filtered by status."""
    svc = LenderService(db)
    loans = await svc.get_my_loans(user, status)
    return {"ok": True, "data": loans}


@router.get("/loans/stats", response_model=dict, summary="Loan portfolio stats")
async def get_loan_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = LenderService(db)
    stats = await svc.get_loan_stats(user)
    return {"ok": True, "data": stats}
