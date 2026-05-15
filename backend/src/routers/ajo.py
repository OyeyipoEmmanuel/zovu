"""
Ajo router — admin-managed savings groups.

New flow:
  - Only admins create groups (name, end_date, minimum_deposit).
  - Funds are deposited to the configured Squad merchant account.
  - Users (traders + job seekers) can join and contribute any amount >= minimum_deposit.
  - Every contribution / payout is recorded in AjoTransaction.
  - Total user savings flows into the pulse score recalculation (see workers/credit_tasks.py).
"""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
import httpx

from src.core.database import get_db
from src.core.redis_client import get_redis_cache
from src.dependencies import get_current_user, require_admin
from src.models import (
    User,
    Ajo,
    AjoMembership,
    AjoStatus,
    AjoTransaction,
    Transaction,
    TransactionType,
)
from src.core.exceptions import ZovuAPIError, ExternalServiceError
from src.services.squad import SquadService
from src.config import settings
import structlog

logger = structlog.get_logger()

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────


class CreateAjoRequest(BaseModel):
    name: str
    description: str | None = None
    minimum_deposit: int  # KOBO
    end_date: datetime
    max_members: int = 50


class ContributeRequest(BaseModel):
    amount: int  # KOBO


def _ajo_squad_merchant_account() -> str | None:
    """The single merchant Squad account that receives Ajo deposits."""
    return (
        getattr(settings, "AJO_SQUAD_MERCHANT_ACCOUNT", None)
        or getattr(settings, "SQUAD_MERCHANT_ACCOUNT_NUMBER", None)
        or None
    )


def _serialize_ajo(ajo: Ajo, member_count: int = 0, joined: bool = False,
                    total_contributed_kobo: int = 0, estimated_return_kobo: int | None = None) -> dict:
    return {
        "id": ajo.id,
        "name": ajo.name,
        "description": ajo.description,
        "minimum_deposit": int(ajo.contribution_amount or 0),
        "end_date": ajo.end_date.isoformat() if ajo.end_date else None,
        "total_balance": int(ajo.total_balance or 0),
        "member_count": member_count,
        "max_members": ajo.max_members,
        "status": ajo.status,
        "merchant_squad_account": ajo.merchant_squad_account or _ajo_squad_merchant_account(),
        "joined": joined,
        "total_contributed": total_contributed_kobo,
        "estimated_return": estimated_return_kobo,
        "created_at": ajo.created_at.isoformat() if ajo.created_at else None,
    }


# ── User-facing endpoints ────────────────────────────────────────────────────


@router.get("/groups", summary="List Ajo groups (for the authenticated user)")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List active Ajo groups with a `joined` flag for this user."""
    rows = (await db.execute(select(Ajo).where(Ajo.status == AjoStatus.ACTIVE).order_by(Ajo.created_at.desc()))).scalars().all()

    out = []
    for ajo in rows:
        member_count = (await db.execute(
            select(func.count(AjoMembership.id)).where(AjoMembership.ajo_id == ajo.id)
        )).scalar() or 0
        membership = (await db.execute(
            select(AjoMembership).where(and_(AjoMembership.ajo_id == ajo.id, AjoMembership.user_id == user.id))
        )).scalar_one_or_none()

        total_contributed = int(membership.total_contributed) if membership else 0
        # SQLite strips tzinfo on round-trip, so naive end_dates need to be
        # treated as UTC before comparing against aware now().
        end_date = ajo.end_date
        if end_date is not None and end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        # Estimate of returns = total contributions / member_count when group ends.
        # If the user contributes consistently, they will receive a share of total_balance.
        if member_count > 0 and end_date and end_date > datetime.now(timezone.utc):
            estimated = int((ajo.total_balance or 0) / max(1, member_count))
        else:
            estimated = total_contributed
        out.append(_serialize_ajo(ajo, member_count=member_count, joined=membership is not None,
                                   total_contributed_kobo=total_contributed, estimated_return_kobo=estimated))
    return {"ok": True, "data": out}


@router.post("/{ajo_id}/join", summary="Join an Ajo group")
async def join_group(
    ajo_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ajo = await db.get(Ajo, ajo_id)
    if not ajo:
        raise ZovuAPIError(status_code=404, code="AJO_NOT_FOUND", message="Ajo group not found")
    if ajo.status != AjoStatus.ACTIVE:
        raise ZovuAPIError(status_code=409, code="AJO_INACTIVE", message="Ajo group is not active")

    existing = (await db.execute(
        select(AjoMembership).where(and_(AjoMembership.ajo_id == ajo_id, AjoMembership.user_id == user.id))
    )).scalar_one_or_none()
    if existing:
        return {"ok": True, "data": {"membership_id": existing.id, "already_member": True}}

    member_count = (await db.execute(
        select(func.count(AjoMembership.id)).where(AjoMembership.ajo_id == ajo_id)
    )).scalar() or 0
    if member_count >= ajo.max_members:
        raise ZovuAPIError(status_code=409, code="AJO_FULL", message="Ajo group is full")

    membership = AjoMembership(
        ajo_id=ajo_id,
        user_id=user.id,
        payout_order=member_count + 1,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return {"ok": True, "data": {"membership_id": membership.id, "ajo_id": ajo_id, "payout_order": membership.payout_order}}


@router.post("/{ajo_id}/contribute", summary="Contribute to an Ajo group")
async def contribute_to_group(
    ajo_id: str,
    payload: ContributeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Record a contribution. Funds are expected to land in the configured Squad
    merchant account; the squad webhook reconciles the amount with the AjoTransaction
    row created here.
    """
    if payload.amount <= 0:
        raise ZovuAPIError(status_code=400, code="INVALID_AMOUNT", message="amount must be positive (kobo)")

    ajo = await db.get(Ajo, ajo_id)
    if not ajo:
        raise ZovuAPIError(status_code=404, code="AJO_NOT_FOUND", message="Ajo group not found")
    if ajo.status != AjoStatus.ACTIVE:
        raise ZovuAPIError(status_code=409, code="AJO_INACTIVE", message="Ajo group is not active")
    if payload.amount < int(ajo.contribution_amount or 0):
        raise ZovuAPIError(
            status_code=400,
            code="BELOW_MINIMUM",
            message=f"Minimum deposit is {(ajo.contribution_amount or 0) / 100:,.2f} naira",
        )

    membership = (await db.execute(
        select(AjoMembership).where(and_(AjoMembership.ajo_id == ajo_id, AjoMembership.user_id == user.id))
    )).scalar_one_or_none()
    if not membership:
        raise ZovuAPIError(status_code=403, code="NOT_A_MEMBER", message="Join the Ajo group first")

    # 1. Create the AjoTransaction first (pending) so we have an id to reference.
    #    Status stays "pending" until Squad webhook confirms payment.
    ajo_tx = AjoTransaction(
        ajo_id=ajo_id,
        user_id=user.id,
        amount=payload.amount,
        type="contribution",
        status="pending",
        note=f"Contribution to {ajo.name}",
    )
    db.add(ajo_tx)
    await db.flush()  # populate ajo_tx.id

    squad_reference = f"zovu-ajo-{uuid4().hex}"

    # 2. Global ledger entry (mirrors the contribution in the user's tx feed).
    ledger = Transaction(
        sender_id=user.id,
        receiver_id=None,
        transaction_type=TransactionType.AJO_CONTRIBUTION,
        amount=payload.amount,
        direction="debit",
        status="pending",
        method="squad_checkout",
        squad_reference=squad_reference,
        tx_metadata={
            "ajo_id": ajo_id,
            "ajo_name": ajo.name,
            "ajo_transaction_id": ajo_tx.id,
        },
    )
    db.add(ledger)
    await db.flush()  # populate ledger.id

    # 3. Call Squad to create a real checkout session. If Squad call fails we
    #    keep the pending rows and surface the error so the frontend can show a
    #    retry prompt rather than pretend the payment worked.
    checkout_url: str | None = None
    squad_error: str | None = None
    callback_url = f"{settings.FRONTEND_URL.rstrip('/')}/ajo/{ajo_id}?ref={squad_reference}"

    try:
        redis = await get_redis_cache()
        async with httpx.AsyncClient(timeout=30.0) as http:
            squad = SquadService(http=http, db=db, redis=redis)
            session = await squad.initiate_payment(
                email=user.email,
                amount_kobo=payload.amount,
                reference=squad_reference,
                callback_url=callback_url,
                metadata={
                    "ajo_id": ajo_id,
                    "ajo_transaction_id": ajo_tx.id,
                    "user_id": user.id,
                    "purpose": "ajo_contribution",
                },
            )
        checkout_url = session.get("checkout_url")
        # Persist the checkout url on the ledger metadata for future replay.
        meta = dict(ledger.tx_metadata or {})
        meta["squad_checkout_url"] = checkout_url
        ledger.tx_metadata = meta
        logger.info(
            "ajo.contribute_checkout_initiated",
            ajo_id=ajo_id,
            user_id=user.id,
            reference=squad_reference,
            amount=payload.amount,
        )
    except ExternalServiceError as exc:
        squad_error = str(exc.detail)
        logger.error("ajo.contribute_squad_failed", error=squad_error, reference=squad_reference)
    except Exception as exc:
        squad_error = str(exc)
        logger.error("ajo.contribute_squad_unexpected", error=squad_error, reference=squad_reference)

    # 4. NOTE: do NOT touch membership.total_contributed / ajo.total_balance here.
    #    Those are only incremented in the webhook handler when Squad confirms
    #    the payment landed, otherwise users could fake balances by spamming
    #    /contribute without paying. Pulse-score recalc fires from the webhook
    #    too, for the same reason.

    await db.commit()

    if squad_error:
        raise ZovuAPIError(
            status_code=502,
            code="SQUAD_UNAVAILABLE",
            message=(
                "We could not start the Squad checkout right now. "
                "Your contribution is queued — please retry in a moment."
            ),
        )

    return {"ok": True, "data": {
        "ajo_id": ajo_id,
        "amount_pending": payload.amount,
        "squad_reference": squad_reference,
        "checkout_url": checkout_url,
        "merchant_squad_account": ajo.merchant_squad_account or _ajo_squad_merchant_account(),
        "ajo_transaction_id": ajo_tx.id,
        "status": "pending",
        "instructions": (
            "Open checkout_url to complete payment. Your contribution will be "
            "reflected once Squad confirms via webhook."
        ),
    }}


@router.get("/transactions", summary="Ajo transactions for the authenticated user")
async def list_my_ajo_transactions(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        select(AjoTransaction, Ajo)
        .join(Ajo, Ajo.id == AjoTransaction.ajo_id)
        .where(AjoTransaction.user_id == user.id)
        .order_by(AjoTransaction.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return {"ok": True, "data": [
        {
            "id": tx.id,
            "ajo_id": tx.ajo_id,
            "ajo_name": ajo.name,
            "amount": tx.amount,
            "type": tx.type,
            "status": tx.status,
            "timestamp": tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx, ajo in rows
    ]}


@router.get("/{ajo_id}", summary="Get Ajo group details")
async def get_ajo(
    ajo_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ajo = await db.get(Ajo, ajo_id)
    if not ajo:
        raise ZovuAPIError(status_code=404, code="AJO_NOT_FOUND", message="Ajo group not found")

    members = (await db.execute(select(AjoMembership).where(AjoMembership.ajo_id == ajo_id))).scalars().all()
    membership = next((m for m in members if m.user_id == user.id), None)
    total_contributed = int(membership.total_contributed) if membership else 0
    return {"ok": True, "data": _serialize_ajo(
        ajo,
        member_count=len(members),
        joined=membership is not None,
        total_contributed_kobo=total_contributed,
        estimated_return_kobo=int((ajo.total_balance or 0) / max(1, len(members))) if members else 0,
    )}
