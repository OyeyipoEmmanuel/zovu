"""
Credit router — credit status, deposit, activity feed, and Ajo squad endpoints.
"""
import json
import hashlib
import base64
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from src.core.database import get_db
from src.dependencies import get_current_user
from src.models import User, Credit, Transaction
from src.core.redis_client import get_redis_cache
from src.core.utils import display_name, mask_account_number, get_pulse_tier, format_naira
from src.services.credit import CreditService
from src.schemas.auth import CreditResponseSchema
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/credit", tags=["Credit"])

ACTIVITY_FEED_CACHE_TTL = 60  # 1 minute
ACTIVITY_FEED_MIN_KOBO = 500_000  # ₦5,000


@router.get("/activity-feed", response_model=dict, summary="Live credit activity feed")
async def get_activity_feed(
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis_cache),
):
    """
    Public social-proof feed of significant inflow transactions.
    Cached per page (1-minute TTL). Masks names and account numbers.
    """
    cache_key = "activity_feed:" + hashlib.md5(f"{limit}:{cursor or ''}".encode()).hexdigest()

    try:
        cached = await redis.get(cache_key)
        if cached:
            return {"ok": True, **json.loads(cached), "cached": True}
    except Exception:
        pass

    q = (
        select(Transaction, User)
        .join(User, Transaction.receiver_id == User.id)
        .where(
            Transaction.status == "completed",
            Transaction.direction == "credit",
            Transaction.amount >= ACTIVITY_FEED_MIN_KOBO,
        )
        .order_by(desc(Transaction.created_at))
        .limit(limit + 1)
    )

    if cursor:
        try:
            cursor_data = json.loads(base64.b64decode(cursor).decode())
            q = q.where(
                and_(
                    Transaction.created_at <= cursor_data["timestamp"],
                    Transaction.id != cursor_data["id"],
                )
            )
        except Exception:
            pass

    rows = (await db.execute(q)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    feed_items = []
    for txn, user in rows:
        credit_row = None
        try:
            credit_q = select(Credit).where(Credit.user_id == user.id)
            credit_row = (await db.execute(credit_q)).scalar_one_or_none()
        except Exception:
            pass
        score = credit_row.pulse_score if credit_row else 0
        tier = get_pulse_tier(score)

        user_type_label = (
            "trader" if (user.role or "").lower() == "trader"
            else "job seeker" if (user.role or "").lower() in ("job_seeker", "seeker")
            else "member"
        )
        amount_display = format_naira(txn.amount or 0)
        action_label = f"depositing {amount_display} into their ZOVU account"

        feed_items.append({
            "id": txn.id,
            "display_name": display_name(user.first_name or "A user", user.last_name or ""),
            "masked_account": mask_account_number(user.squad_account_number or ""),
            "user_type": user_type_label,
            "amount": txn.amount,
            "amount_display": amount_display,
            "action_label": action_label,
            "tier": tier,
            "previous_tier": tier,
            "current_tier": tier,
            "tier_changed": False,
            "created_at": txn.created_at.isoformat() if txn.created_at else None,
        })

    next_cursor = None
    if has_more and feed_items:
        last = feed_items[-1]
        next_cursor = base64.b64encode(
            json.dumps({"timestamp": last["created_at"], "id": last["id"]}).encode()
        ).decode()

    payload = {"data": feed_items, "has_more": has_more, "cursor": next_cursor}
    try:
        await redis.setex(cache_key, ACTIVITY_FEED_CACHE_TTL, json.dumps(payload))
    except Exception:
        pass

    return {"ok": True, **payload}


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


# ── Pulse signals + history ─────────────────────────────────────────────────


@router.get("/pulse-signals", response_model=dict, summary="Pulse score signal breakdown")
async def get_pulse_signals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return six signal values (0-100) that explain the Pulse Score.
    Derived live from the user's transactions, savings, completion rate, etc.
    """
    from sqlalchemy import func as sa_func
    from src.models import Transaction, Loan, GigApplication, LoanStatus, AjoMembership
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=90)

    # 1. Transaction frequency — count of transactions in 90d, capped at 60
    txn_count_q = select(sa_func.count(Transaction.id)).where(
        and_(
            Transaction.receiver_id == user.id,
            Transaction.status == "completed",
            Transaction.created_at >= period_start,
        )
    )
    txn_count = (await db.execute(txn_count_q)).scalar() or 0
    transaction_frequency = min(100, int((txn_count / 60.0) * 100))

    # 2. Transaction growth — compare last 30d vs previous 30d
    last_30 = now - timedelta(days=30)
    prev_30 = now - timedelta(days=60)
    recent_sum = (await db.execute(
        select(sa_func.coalesce(sa_func.sum(Transaction.amount), 0)).where(
            Transaction.receiver_id == user.id,
            Transaction.status == "completed",
            Transaction.created_at >= last_30,
        )
    )).scalar() or 0
    prev_sum = (await db.execute(
        select(sa_func.coalesce(sa_func.sum(Transaction.amount), 0)).where(
            Transaction.receiver_id == user.id,
            Transaction.status == "completed",
            Transaction.created_at >= prev_30,
            Transaction.created_at < last_30,
        )
    )).scalar() or 0
    if prev_sum > 0:
        growth_pct = max(-100.0, min(200.0, (recent_sum - prev_sum) / prev_sum * 100.0))
        transaction_growth = int(max(0, min(100, (growth_pct + 100) / 2)))
    else:
        transaction_growth = 50 if recent_sum > 0 else 0

    # 3. Gig / job completion rate — use seeker completion_rate if available
    completion_rate = int(round(float(user.completion_rate or 0.0) * 100))
    if completion_rate == 0:
        # Fallback: ratio of accepted applications to total
        apps_q = select(GigApplication).where(GigApplication.seeker_id == user.id)
        apps = (await db.execute(apps_q)).scalars().all()
        if apps:
            done = sum(1 for a in apps if a.status == "accepted")
            completion_rate = int(round((done / len(apps)) * 100))
    gig_completion_rate = min(100, completion_rate)

    # 4. Repayment history — proportion of loans that are repaid
    loans_q = select(Loan).where(Loan.user_id == user.id)
    loans = (await db.execute(loans_q)).scalars().all()
    if loans:
        repaid = sum(1 for l in loans if l.status == LoanStatus.COMPLETED)
        defaulted = sum(1 for l in loans if l.status == LoanStatus.DEFAULTED)
        score = max(0, repaid * 100 - defaulted * 30) / len(loans)
        repayment_history = int(min(100, score))
    else:
        # No loans yet: neutral baseline from punctuality
        repayment_history = int(round(float(user.repayment_punctuality or 0.0) * 100))

    # 5. Network density — number of unique counterparties
    counterparty_q = select(sa_func.count(sa_func.distinct(Transaction.sender_id))).where(
        Transaction.receiver_id == user.id,
        Transaction.status == "completed",
        Transaction.sender_id.isnot(None),
    )
    counterparties = (await db.execute(counterparty_q)).scalar() or 0
    network_density = min(100, int(counterparties * 5))

    # 6. Financial discipline — combines savings balance + ajo participation + auto-save pct
    ajo_q = select(sa_func.count(AjoMembership.id)).where(AjoMembership.user_id == user.id)
    ajo_count = (await db.execute(ajo_q)).scalar() or 0
    savings_kobo = int(user.ajo_savings_balance or 0)
    savings_signal = min(50, savings_kobo / 1_000_00)  # 1k naira per pt, cap 50
    ajo_signal = min(30, ajo_count * 10)
    auto_save_signal = min(20, float(user.auto_save_pct or 0.0) * 20)
    financial_discipline = int(min(100, savings_signal + ajo_signal + auto_save_signal))

    signals = [
        {"label": "Transaction Frequency", "value": transaction_frequency},
        {"label": "Transaction Growth", "value": transaction_growth},
        {"label": "Gig Completion Rate", "value": gig_completion_rate},
        {"label": "Repayment History", "value": repayment_history},
        {"label": "Network Density", "value": network_density},
        {"label": "Financial Discipline", "value": financial_discipline},
    ]
    return {"ok": True, "data": {"signals": signals}}


@router.get("/pulse-history", response_model=dict, summary="Pulse score history over months")
async def get_pulse_history(
    months: int = Query(6, ge=1, le=12),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns last N months of pulse score snapshots."""
    from src.models import PulseScore
    from datetime import datetime, timezone, timedelta

    q = (
        select(PulseScore)
        .where(PulseScore.user_id == user.id)
        .order_by(desc(PulseScore.calculation_timestamp))
        .limit(months)
    )
    rows = list((await db.execute(q)).scalars().all())
    rows.reverse()

    # Fallback: derive from current pulse score if no snapshots
    if not rows:
        now = datetime.now(timezone.utc)
        current = int(user.pulse_score or 0)
        synthetic = []
        for i in range(min(months, 5), 0, -1):
            month_label = (now - timedelta(days=30 * i)).strftime("%b")
            synthetic.append({"month": month_label, "score": max(0, current - (i * 20))})
        synthetic.append({"month": now.strftime("%b"), "score": current})
        return {"ok": True, "data": synthetic}

    return {"ok": True, "data": [
        {"month": r.calculation_timestamp.strftime("%b") if r.calculation_timestamp else "", "score": int(r.total_score or 0)}
        for r in rows
    ]}
