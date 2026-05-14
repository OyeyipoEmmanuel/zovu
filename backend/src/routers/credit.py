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
