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
from src.models import User, Transaction, Ajo, Gig, TransactionType
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


# ── Enrichment helpers ──────────────────────────────────────────────
#
# These resolve the human-readable counterparty + purpose for a transaction
# so the trader/seeker frontends can display rows like:
#   "You contributed ₦5,000 to Ajo 'Lagos Daily Savers'"
#   "Lekan paid you ₦12,000 for gig 'Help with deliveries'"
# without having to follow extra references from the client.
#
# Resolution order:
#   1. sender/receiver user rows → display name
#   2. tx_metadata.purpose + ajo_id/gig_id → contextual label
#   3. transaction_type fallback (e.g. "Loan disbursement")


def _user_label(u: User | None) -> str | None:
    """Render a public-safe display name for a counterparty."""
    if u is None:
        return None
    candidate = (
        (u.full_name or "").strip()
        or f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip()
        or u.business_name
        or u.company_name
        or u.email
    )
    return candidate or None


async def _build_enrichment_caches(
    db: AsyncSession,
    transactions: list[Transaction],
) -> tuple[dict[str, User], dict[str, Ajo], dict[str, Gig]]:
    """Bulk-load the related users / ajos / gigs in three queries instead of N+1."""
    user_ids: set[str] = set()
    ajo_ids: set[str] = set()
    gig_ids: set[str] = set()
    for t in transactions:
        if t.sender_id:
            user_ids.add(t.sender_id)
        if t.receiver_id:
            user_ids.add(t.receiver_id)
        meta = t.tx_metadata or {}
        if isinstance(meta, dict):
            if meta.get("ajo_id"):
                ajo_ids.add(str(meta["ajo_id"]))
            if meta.get("gig_id"):
                gig_ids.add(str(meta["gig_id"]))

    user_cache: dict[str, User] = {}
    if user_ids:
        rows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        user_cache = {u.id: u for u in rows}

    ajo_cache: dict[str, Ajo] = {}
    if ajo_ids:
        rows = (await db.execute(select(Ajo).where(Ajo.id.in_(ajo_ids)))).scalars().all()
        ajo_cache = {a.id: a for a in rows}

    gig_cache: dict[str, Gig] = {}
    if gig_ids:
        rows = (await db.execute(select(Gig).where(Gig.id.in_(gig_ids)))).scalars().all()
        gig_cache = {g.id: g for g in rows}

    return user_cache, ajo_cache, gig_cache


def _purpose_for(
    t: Transaction,
    ajo_cache: dict[str, Ajo],
    gig_cache: dict[str, Gig],
) -> str:
    """Best-effort human label for what the transaction was for."""
    meta = t.tx_metadata or {}
    if not isinstance(meta, dict):
        meta = {}

    meta_purpose = (meta.get("purpose") or "").strip()
    ajo_id = meta.get("ajo_id")
    gig_id = meta.get("gig_id")

    # Prefer the most specific label we can build.
    ttype = t.transaction_type
    if ttype == TransactionType.AJO_CONTRIBUTION:
        ajo = ajo_cache.get(str(ajo_id)) if ajo_id else None
        ajo_name = (ajo.name if ajo else None) or meta.get("ajo_name")
        return f"Contribution to Ajo '{ajo_name}'" if ajo_name else "Ajo contribution"
    if ttype == TransactionType.AJO_PAYOUT:
        ajo = ajo_cache.get(str(ajo_id)) if ajo_id else None
        ajo_name = (ajo.name if ajo else None) or meta.get("ajo_name")
        return f"Payout from Ajo '{ajo_name}'" if ajo_name else "Ajo payout"
    if ttype == TransactionType.LOAN_DISBURSEMENT:
        return "Loan disbursement"
    if ttype == TransactionType.LOAN_REPAYMENT:
        return "Loan repayment"
    if ttype == TransactionType.CREDIT_DEPOSIT:
        if meta_purpose == "squad_wallet_deposit":
            return "Wallet top-up"
        return "Deposit"
    if ttype == TransactionType.CREDIT_WITHDRAWAL:
        if meta_purpose == "trader_to_seeker_payout":
            gig = gig_cache.get(str(gig_id)) if gig_id else None
            if gig and gig.title:
                return f"Gig payment — '{gig.title}'"
            return "Gig payment"
        if meta_purpose == "external_payout":
            return "Bank transfer (external)"
        return "Withdrawal"

    return meta_purpose.replace("_", " ").capitalize() if meta_purpose else "Transaction"


def _enrich_transaction(
    t: Transaction,
    viewer: User,
    user_cache: dict[str, User],
    ajo_cache: dict[str, Ajo],
    gig_cache: dict[str, Gig],
) -> dict:
    """Build a fully-resolved row for the given transaction from the viewer's POV."""
    sender = user_cache.get(t.sender_id) if t.sender_id else None
    receiver = user_cache.get(t.receiver_id) if t.receiver_id else None

    sender_name = _user_label(sender) or ("ZOVU system" if t.sender_id is None else None)
    receiver_name = _user_label(receiver) or ("ZOVU system" if t.receiver_id is None else None)

    # Build the counterparty (the side that isn't the viewer).
    if t.sender_id == viewer.id:
        counterparty = receiver
        counterparty_name = receiver_name
    elif t.receiver_id == viewer.id:
        counterparty = sender
        counterparty_name = sender_name
    else:
        counterparty = None
        counterparty_name = None

    direction = "inflow" if t.direction == "credit" else "outflow"
    amount_display = format_naira(t.amount or 0)
    purpose = _purpose_for(t, ajo_cache, gig_cache)

    if direction == "inflow":
        feed_label = f"Received {amount_display}"
        if counterparty_name:
            feed_label += f" from {counterparty_name}"
        feed_label += f" — {purpose}"
    else:
        feed_label = f"Sent {amount_display}"
        if counterparty_name:
            feed_label += f" to {counterparty_name}"
        feed_label += f" — {purpose}"

    return {
        "id": t.id,
        "sender_id": t.sender_id,
        "sender_name": sender_name,
        "receiver_id": t.receiver_id,
        "receiver_name": receiver_name,
        "counterparty_id": counterparty.id if counterparty else None,
        "counterparty_display": counterparty_name,
        "transaction_type": t.transaction_type,
        "purpose": purpose,
        "amount": t.amount,
        "amount_display": amount_display,
        "status": t.status,
        "squad_reference": t.squad_reference,
        "loan_id": t.loan_id,
        "direction": direction,
        "masked_account": mask_account_number(viewer.squad_account_number or ""),
        "feed_label": feed_label,
        "metadata": t.tx_metadata,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


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

    user_cache, ajo_cache, gig_cache = await _build_enrichment_caches(db, transactions)

    payload = {
        "items": [
            _enrich_transaction(t, user, user_cache, ajo_cache, gig_cache)
            for t in transactions
        ],
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

    user_cache, ajo_cache, gig_cache = await _build_enrichment_caches(db, [transaction])
    enriched = _enrich_transaction(transaction, user, user_cache, ajo_cache, gig_cache)
    enriched["updated_at"] = transaction.updated_at.isoformat() if transaction.updated_at else None
    return enriched

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


class TraderDepositRequest(BaseModel):
    """Trader funds their Squad wallet to pay job seekers."""
    amount_kobo: int
    callback_url: str
    metadata: Optional[dict] = None


class TraderPaySeekerRequest(BaseModel):
    """Trader pays an on-platform job seeker by user id."""
    seeker_id: str
    amount_kobo: int
    gig_id: Optional[str] = None
    narration: Optional[str] = None


class SquadTransferRequest(BaseModel):
    """Off-platform Squad payout: pay to an external bank account."""
    account_number: str
    bank_code: str
    amount_kobo: int
    narration: str
    account_name: Optional[str] = None


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


# ------------------------------------------------------------------ #
#  Trader → Squad wallet deposit                                       #
# ------------------------------------------------------------------ #


@router.post(
    "/squad/deposit",
    response_model=dict,
    tags=["Transactions"],
    summary="Trader deposit into Squad ledger",
)
async def squad_deposit(
    body: TraderDepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    Start a Squad checkout that deposits funds into the trader's Squad wallet.
    The trader's funded balance is then drawn from by /squad/transfer-to-seeker
    when they pay job seekers after a gig is complete.

    Funds land in the configured AJO_SQUAD_MERCHANT_ACCOUNT and a pending
    Transaction ledger row is created. The webhook reconciles the deposit.
    """
    if body.amount_kobo <= 0:
        raise HTTPException(status_code=400, detail="amount_kobo must be > 0")

    from src.core.exceptions import ZovuAPIError
    from src.models.base import TransactionType
    reference = f"zovu-deposit-{uuid.uuid4().hex}"

    tx = Transaction(
        sender_id=user.id,  # trader funding their own wallet
        receiver_id=None,
        transaction_type=TransactionType.CREDIT_DEPOSIT,
        amount=body.amount_kobo,
        amount_gross=body.amount_kobo,
        direction="credit",  # increases trader's balance once settled
        status="pending",
        method="squad_checkout",
        squad_reference=reference,
        tx_metadata={
            "purpose": "squad_wallet_deposit",
            "user_id": user.id,
            **(body.metadata or {}),
        },
    )
    db.add(tx)
    await db.flush()

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(db=db, redis=redis, http=http)
            session = await squad.initiate_payment(
                email=user.email,
                amount_kobo=body.amount_kobo,
                reference=reference,
                callback_url=body.callback_url,
                metadata={
                    "purpose": "squad_wallet_deposit",
                    "user_id": user.id,
                    "transaction_id": tx.id,
                },
            )
    except ExternalServiceError as exc:
        await db.commit()  # keep the pending tx for retry
        raise HTTPException(status_code=502, detail=str(exc))

    meta = dict(tx.tx_metadata or {})
    meta["squad_checkout_url"] = session.get("checkout_url")
    tx.tx_metadata = meta
    await db.commit()

    return {
        "ok": True,
        "data": {
            "transaction_id": tx.id,
            "squad_reference": reference,
            "checkout_url": session.get("checkout_url"),
            "amount_kobo": body.amount_kobo,
            "status": "pending",
        },
    }


@router.post(
    "/squad/transfer-to-seeker",
    response_model=dict,
    tags=["Transactions"],
    summary="Trader pays a job seeker via Squad transfer",
)
async def squad_transfer_to_seeker(
    body: TraderPaySeekerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    After a gig is completed, a trader can pay the assigned job seeker.
    The seeker must have a provisioned Squad virtual account.
    """
    from src.core.exceptions import ZovuAPIError
    from src.models.base import TransactionType, GigStatus

    if body.amount_kobo <= 0:
        raise ZovuAPIError(status_code=400, code="INVALID_AMOUNT", message="amount_kobo must be > 0")

    seeker_q = select(User).where(User.id == body.seeker_id)
    seeker = (await db.execute(seeker_q)).scalar_one_or_none()
    if not seeker:
        raise ZovuAPIError(status_code=404, code="SEEKER_NOT_FOUND", message="Job seeker not found")
    if not seeker.squad_account_number or not seeker.squad_account_bank:
        raise ZovuAPIError(
            status_code=400,
            code="SEEKER_HAS_NO_VA",
            message="The job seeker hasn't been provisioned with a Squad virtual account yet (KYC pending).",
        )

    # Optional gig check — make sure the trader owns the gig and it's completed
    if body.gig_id:
        from src.models.base import Gig
        gig = await db.get(Gig, body.gig_id)
        if not gig:
            raise ZovuAPIError(status_code=404, code="GIG_NOT_FOUND", message="Gig not found")
        if gig.trader_id != user.id:
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your gig")
        if gig.status not in (GigStatus.COMPLETED, GigStatus.IN_PROGRESS):
            raise ZovuAPIError(
                status_code=409,
                code="GIG_NOT_PAYABLE",
                message="Only in-progress or completed gigs can be paid out.",
            )

    reference = f"zovu-gigpay-{uuid.uuid4().hex}"
    narration = (body.narration or f"Zovu gig payment from {user.email} to {seeker.email}")[:90]

    tx = Transaction(
        sender_id=user.id,
        receiver_id=seeker.id,
        transaction_type=TransactionType.CREDIT_WITHDRAWAL,
        amount=body.amount_kobo,
        amount_gross=body.amount_kobo,
        direction="debit",
        status="pending",
        method="squad_transfer",
        squad_reference=reference,
        tx_metadata={
            "purpose": "trader_to_seeker_payout",
            "trader_id": user.id,
            "seeker_id": seeker.id,
            "gig_id": body.gig_id,
        },
    )
    db.add(tx)
    await db.flush()

    # Try the Squad transfer. The seeker's bank_code lives in `squad_account_bank`
    # (we keep the bank name; we lookup the NIP code via SQUAD_BANK_CODE_TO_NAME).
    from src.services.squad import SQUAD_BANK_CODE_TO_NAME
    bank_code = ""
    for code, name in SQUAD_BANK_CODE_TO_NAME.items():
        if name.lower() == (seeker.squad_account_bank or "").lower():
            bank_code = code
            break
    if not bank_code:
        # Default to GTBank (Squad's primary issuing partner) as a fallback.
        bank_code = "058"

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(db=db, redis=redis, http=http)
            result = await squad.transfer_funds(
                recipient_account=seeker.squad_account_number,
                bank_code=bank_code,
                amount_kobo=body.amount_kobo,
                reference=reference,
                narration=narration,
            )
        tx.status = "completed" if (result.get("status") or "").lower() in ("success", "successful", "completed") else "processing"
        meta = dict(tx.tx_metadata or {})
        meta["squad_transaction_id"] = result.get("squad_transaction_id")
        meta["squad_status"] = result.get("status")
        meta["nip_session_id"] = result.get("nip_session_id")
        tx.tx_metadata = meta
        await db.commit()

        return {"ok": True, "data": {
            "transaction_id": tx.id,
            "squad_reference": reference,
            "status": tx.status,
            "amount_kobo": body.amount_kobo,
            "seeker_id": seeker.id,
            "seeker_account": seeker.squad_account_number,
        }}
    except ExternalServiceError as exc:
        tx.status = "failed"
        meta = dict(tx.tx_metadata or {})
        meta["error"] = str(exc.detail) if hasattr(exc, "detail") else str(exc)
        tx.tx_metadata = meta
        await db.commit()
        raise HTTPException(status_code=502, detail=str(exc))


@router.post(
    "/squad/transfer",
    response_model=dict,
    tags=["Transactions"],
    summary="Generic Squad payout to an external bank account",
)
async def squad_transfer(
    body: SquadTransferRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    if body.amount_kobo <= 0:
        raise HTTPException(status_code=400, detail="amount_kobo must be > 0")

    from src.models.base import TransactionType

    reference = f"zovu-txout-{uuid.uuid4().hex}"
    tx = Transaction(
        sender_id=user.id,
        receiver_id=None,
        transaction_type=TransactionType.CREDIT_WITHDRAWAL,
        amount=body.amount_kobo,
        amount_gross=body.amount_kobo,
        direction="debit",
        status="pending",
        method="squad_transfer",
        squad_reference=reference,
        tx_metadata={
            "purpose": "external_payout",
            "user_id": user.id,
            "bank_code": body.bank_code,
            "account_number": body.account_number,
        },
    )
    db.add(tx)
    await db.flush()

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(db=db, redis=redis, http=http)
            result = await squad.transfer_funds(
                recipient_account=body.account_number,
                bank_code=body.bank_code,
                amount_kobo=body.amount_kobo,
                reference=reference,
                narration=body.narration[:90],
                account_name=body.account_name,
            )
        tx.status = "completed" if (result.get("status") or "").lower() in ("success", "successful", "completed") else "processing"
        await db.commit()
        return {"ok": True, "data": {
            "transaction_id": tx.id,
            "squad_reference": reference,
            "status": tx.status,
            "result": result,
        }}
    except ExternalServiceError as exc:
        tx.status = "failed"
        await db.commit()
        raise HTTPException(status_code=502, detail=str(exc))