"""
Transactions router — list transactions with cursor-based pagination.
"""
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, Query, HTTPException
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, desc, or_
# pyrefly: ignore [missing-import]
from src.core.database import get_db
# pyrefly: ignore [missing-import]
from src.core.redis_client import get_redis_cache
# pyrefly: ignore [missing-import]
from src.dependencies import get_current_user
# pyrefly: ignore [missing-import]
from src.models import User, Transaction
# pyrefly: ignore [missing-import]
from src.services.squad import SquadService
# pyrefly: ignore [missing-import]
from src.core.exceptions import ExternalServiceError
from src.core.utils import mask_account_number, format_naira
# pyrefly: ignore [missing-import]
import structlog
# pyrefly: ignore [missing-import]
import base64
# pyrefly: ignore [missing-import]
import json
# pyrefly: ignore [missing-import]
import httpx
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from redis.asyncio import Redis
# pyrefly: ignore [missing-import]
from typing import Optional
# pyrefly: ignore [missing-import]
import uuid

logger = structlog.get_logger()

router = APIRouter()


@router.get(
    "",
    response_model=dict,
    tags=["Transactions"],
    summary="List Transactions",
    description="List user's transactions with cursor-based pagination",
)
async def list_transactions(
    limit: int = Query(12, ge=1, le=100, description="Page size"),
    cursor: str = Query(None, description="Pagination cursor"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    List user's transactions with cursor-based pagination.
    
    **Cursor-based pagination** ensures consistent results even as data changes.
    
    Query params:
    - **limit**: Number of items (1-100, default 12)
    - **cursor**: Pagination cursor (from previous response)
    
    Returns items in reverse chronological order (newest first).
    """
    cache_key = None
    if not cursor:
        cache_key = f"txns:list:{user.id}:{limit}"
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached.decode() if isinstance(cached, bytes) else cached)
        except Exception as exc:
            logger.warning("transactions_cache_get_failed", error=str(exc))

    # Decode cursor if provided
    starting_timestamp = None
    if cursor:
        try:
            cursor_data = json.loads(base64.b64decode(cursor).decode())
            starting_timestamp = cursor_data.get("timestamp")
        except Exception as e:
            logger.warning("cursor_decode_failed", error=str(e))
    
    # Query transactions where user is sender or receiver
    query = select(Transaction).where(
        or_(Transaction.sender_id == user.id, Transaction.receiver_id == user.id)
    )
    query = query.order_by(desc(Transaction.created_at))
    
    # If cursor provided, filter to items before that timestamp
    if starting_timestamp:
        from datetime import datetime, timezone
        cursor_dt = datetime.fromisoformat(starting_timestamp).replace(tzinfo=timezone.utc)
        query = query.where(Transaction.created_at < cursor_dt)
    
    # Fetch limit + 1 to determine if more results exist
    query = query.limit(limit + 1)
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    # Check if more results exist
    has_more = len(transactions) > limit
    if has_more:
        transactions = transactions[:limit]
    
    # Generate next cursor
    next_cursor = None
    if has_more and transactions:
        last_transaction = transactions[-1]
        cursor_data = {
            "timestamp": last_transaction.created_at.isoformat(),
            "id": last_transaction.id,
        }
        next_cursor = base64.b64encode(
            json.dumps(cursor_data).encode()
        ).decode()
    
    def _enrich(t) -> dict:
        direction = "inflow" if t.direction == "credit" else "outflow"
        amount_display = format_naira(t.amount or 0)
        feed_label = (
            f"Received {amount_display} into your ZOVU virtual account"
            if direction == "inflow"
            else f"Sent {amount_display} from your ZOVU virtual account"
        )
        return {
            "id": t.id,
            "sender_id": t.sender_id,
            "receiver_id": t.receiver_id,
            "transaction_type": t.transaction_type,
            "amount": t.amount,
            "amount_display": amount_display,
            "status": t.status,
            "squad_reference": t.squad_reference,
            "loan_id": t.loan_id,
            "direction": direction,
            "masked_account": mask_account_number(user.squad_account_number or ""),
            "feed_label": feed_label,
            "counterparty_display": None,
            "created_at": t.created_at.isoformat(),
        }

    payload = {
        "items": [_enrich(t) for t in transactions],
        "total": len(transactions),
        "cursor": next_cursor,
        "has_more": has_more,
    }
    if cache_key:
        try:
            await redis.setex(cache_key, 60, json.dumps(payload))
        except Exception as exc:
            logger.warning("transactions_cache_set_failed", error=str(exc))
    return payload


@router.get(
    "/{transaction_id}",
    response_model=dict,
    tags=["Transactions"],
    summary="Get Transaction",
    description="Get transaction details",
)
async def get_transaction(
    transaction_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get specific transaction details.
    
    - **transaction_id**: Transaction ID
    """
    query = select(Transaction).where(
        Transaction.id == transaction_id,
        or_(Transaction.sender_id == user.id, Transaction.receiver_id == user.id)
    )
    result = await db.execute(query)
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    direction = "inflow" if transaction.direction == "credit" else "outflow"
    amount_display = format_naira(transaction.amount or 0)
    feed_label = (
        f"Received {amount_display} into your ZOVU virtual account"
        if direction == "inflow"
        else f"Sent {amount_display} from your ZOVU virtual account"
    )

    return {
        "id": transaction.id,
        "sender_id": transaction.sender_id,
        "receiver_id": transaction.receiver_id,
        "transaction_type": transaction.transaction_type,
        "amount": transaction.amount,
        "amount_display": amount_display,
        "status": transaction.status,
        "squad_reference": transaction.squad_reference,
        "loan_id": transaction.loan_id,
        "direction": direction,
        "masked_account": mask_account_number(user.squad_account_number or ""),
        "feed_label": feed_label,
        "counterparty_display": None,
        "metadata": transaction.tx_metadata,
        "created_at": transaction.created_at.isoformat(),
        "updated_at": transaction.updated_at.isoformat(),
    }

# ------------------------------------------------------------------ #
#  Payment schemas                                                     #
# ------------------------------------------------------------------ #

class InitiatePaymentRequest(BaseModel):
    amount_kobo: int
    callback_url: str
    currency: str = "NGN"
    metadata: Optional[dict] = None


class ValidateBankPaymentRequest(BaseModel):
    transaction_ref: str
    otp: str


class AuthorizeCardRequest(BaseModel):
    transaction_ref: str
    card_token: str


# ------------------------------------------------------------------ #
#  Payment endpoints                                                   #
# ------------------------------------------------------------------ #

@router.post(
    "/initiate",
    response_model=dict,
    tags=["Transactions"],
    summary="Initiate Payment",
    description="Create a Squad checkout session and return the checkout URL",
)
async def initiate_payment(
    body: InitiatePaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    Initiate a checkout payment via Squad.

    - **amount_kobo**: Amount in kobo (e.g. 10000 = ₦100)
    - **callback_url**: URL Squad redirects to after payment
    - **currency**: Default NGN
    """
    reference = f"zovu-{uuid.uuid4().hex}"
    email = f"{user.id}@zovu.internal"

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(db=db, redis=redis, http=http)
            result = await squad.initiate_payment(
                email=email,
                amount_kobo=body.amount_kobo,
                reference=reference,
                callback_url=body.callback_url,
                currency=body.currency,
                metadata=body.metadata,
            )
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return result


@router.get(
    "/verify/{transaction_ref}",
    response_model=dict,
    tags=["Transactions"],
    summary="Verify Transaction",
    description="Verify a Squad transaction by its reference",
)
async def verify_transaction(
    transaction_ref: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    Verify transaction status with Squad.

    - **transaction_ref**: The transaction reference (e.g. zovu-abc123)
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(db=db, redis=redis, http=http)
            result = await squad.verify_transaction(transaction_ref)
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return result


@router.post(
    "/validate-bank-payment",
    response_model=dict,
    tags=["Transactions"],
    summary="Validate Bank Payment",
    description="Submit OTP to complete a direct bank payment",
)
async def validate_bank_payment(
    body: ValidateBankPaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    Validate a direct bank payment via OTP.

    - **transaction_ref**: Reference from the initial payment
    - **otp**: One-time password from the bank
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(db=db, redis=redis, http=http)
            result = await squad.validate_bank_payment(
                transaction_ref=body.transaction_ref,
                otp=body.otp,
            )
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return result


@router.post(
    "/authorize-card",
    response_model=dict,
    tags=["Transactions"],
    summary="Authorize Card Payment",
    description="Authorize a card payment using a card token",
)
async def authorize_card_payment(
    body: AuthorizeCardRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    Authorize a card payment.

    - **transaction_ref**: Reference from the initial payment
    - **card_token**: Tokenised card from Squad's frontend SDK
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(db=db, redis=redis, http=http)
            result = await squad.authorize_card_payment(
                transaction_ref=body.transaction_ref,
                card_token=body.card_token,
            )
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return result