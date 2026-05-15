"""
Lenders router — profile, customers, loans, stats, performance.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.core.database import get_db
from src.dependencies import get_current_user
from src.models import User, LenderServiceOffering
from src.services.LenderService import LenderService
from src.core.exceptions import ZovuAPIError
from sqlalchemy import select, and_
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


# ── Service Offerings (lender's products) ─────────────────────────────────────


def _require_lender_role(user: User) -> None:
    role = (user.role or "").lower()
    if role not in ("lender", "partner", "both", "admin"):
        raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Lender role required")


def _service_to_dict(svc: LenderServiceOffering) -> dict:
    return {
        "id": svc.id,
        "lender_id": svc.lender_id,
        "name": svc.name,
        "type": svc.type,
        "description": svc.description,
        "min_pulse_score": svc.min_pulse_score,
        "max_amount": svc.max_amount,
        "interest_rate": svc.interest_rate,
        "premium_amount": svc.premium_amount,
        "repayment_days": svc.repayment_days,
        "status": svc.status,
        "created_at": svc.created_at.isoformat() if svc.created_at else None,
    }


class OfferServiceRequest(BaseModel):
    name: str
    type: str  # loan | insurance | savings
    description: str | None = None
    min_pulse_score: int = 0
    max_amount: int | None = None  # kobo
    interest_rate: float | None = None
    premium_amount: int | None = None  # kobo
    repayment_days: int | None = None


class UpdateServiceRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    min_pulse_score: int | None = None
    max_amount: int | None = None
    interest_rate: float | None = None
    premium_amount: int | None = None
    repayment_days: int | None = None
    status: str | None = None


@router.post("/services/offer", response_model=dict, summary="Create a new service offering")
async def offer_service(
    payload: OfferServiceRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_lender_role(user)
    if payload.type not in ("loan", "insurance", "savings"):
        raise ZovuAPIError(status_code=400, code="INVALID_TYPE", message="type must be loan, insurance, or savings", field="type")

    svc = LenderServiceOffering(
        lender_id=user.id,
        name=payload.name,
        type=payload.type,
        description=payload.description,
        min_pulse_score=max(0, min(850, int(payload.min_pulse_score or 0))),
        max_amount=payload.max_amount,
        interest_rate=payload.interest_rate,
        premium_amount=payload.premium_amount,
        repayment_days=payload.repayment_days,
        status="active",
    )
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return {"ok": True, "data": _service_to_dict(svc)}


@router.get("/services", response_model=dict, summary="List my service offerings")
async def list_services(
    type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_lender_role(user)
    q = select(LenderServiceOffering).where(LenderServiceOffering.lender_id == user.id)
    if type:
        q = q.where(LenderServiceOffering.type == type)
    rows = (await db.execute(q.order_by(LenderServiceOffering.created_at.desc()))).scalars().all()
    return {"ok": True, "data": [_service_to_dict(s) for s in rows]}


@router.get("/services/{service_id}", response_model=dict, summary="Get a service offering")
async def get_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_lender_role(user)
    svc = await db.get(LenderServiceOffering, service_id)
    if not svc or svc.lender_id != user.id:
        raise ZovuAPIError(status_code=404, code="NOT_FOUND", message="Service offering not found")
    return {"ok": True, "data": _service_to_dict(svc)}


@router.patch("/services/{service_id}", response_model=dict, summary="Update a service offering")
async def update_service(
    service_id: str,
    payload: UpdateServiceRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_lender_role(user)
    svc = await db.get(LenderServiceOffering, service_id)
    if not svc or svc.lender_id != user.id:
        raise ZovuAPIError(status_code=404, code="NOT_FOUND", message="Service offering not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(svc, field, value)
    await db.commit()
    await db.refresh(svc)
    return {"ok": True, "data": _service_to_dict(svc)}
