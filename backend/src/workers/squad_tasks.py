"""
Squad-related Celery tasks.
- retry_squad_provisioning: critical queue, exponential backoff, max 5 retries.
- process_squad_webhook: critical queue, runs after the HTTP handler has
  already verified the signature and acknowledged 200 to Squad.

Event dispatch (process_squad_webhook):
  - Virtual account funding (inbound credit) → write Transaction + recalc score
  - Payout success/failure                  → update existing Transaction status
  - Anything else                            → persist + log only
"""
from src.workers.celery_app import celery_app
import structlog
import asyncio
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

logger = structlog.get_logger()


# ---------------------------------------------------------------------------- #
#  retry_squad_provisioning                                                     #
# ---------------------------------------------------------------------------- #

@celery_app.task(
    bind=True,
    name="squad.retry_squad_provisioning",
    queue="critical",
    max_retries=5,
    default_retry_delay=60,
    acks_late=True,
)
def retry_squad_provisioning(self, user_id: str):
    """
    Retry Squad virtual account creation after initial failure.
    Decrypts the user's BVN and phone from their encrypted columns so we can
    re-submit a valid Squad payload.
    Exponential backoff: 10s, 30s, 90s, 270s, 810s (max ~30 min total).
    On final failure, leaves squad_provisioned=False for manual intervention.
    """
    import httpx

    async def _run():
        from src.core.database import async_session
        from src.core.redis_client import get_redis_blacklist
        from src.core.security import decrypt_pii
        from src.services.squad import SquadService
        from src.models import User
        from sqlalchemy import select

        async with async_session() as db:
            redis = await get_redis_blacklist()
            user = await db.scalar(select(User).where(User.id == user_id))
            if not user:
                logger.error("retry_squad_provisioning_user_not_found", user_id=user_id)
                return

            if user.squad_provisioned and user.squad_account_number:
                logger.info("retry_squad_provisioning_already_done", user_id=user_id)
                return

            if not user.bvn or not user.phone:
                logger.error(
                    "retry_squad_provisioning_missing_pii",
                    user_id=user_id,
                    has_bvn=bool(user.bvn),
                    has_phone=bool(user.phone),
                )
                return

            try:
                bvn_plain = decrypt_pii(user.bvn)
                phone_plain = decrypt_pii(user.phone)
            except Exception as exc:
                logger.error(
                    "retry_squad_provisioning_pii_decrypt_failed",
                    user_id=user_id,
                    error=str(exc),
                )
                raise

            dob_str = (
                user.date_of_birth.strftime("%m/%d/%Y")
                if user.date_of_birth is not None
                else None
            )
            async with httpx.AsyncClient(timeout=30.0) as http:
                squad = SquadService(http=http, db=db, redis=redis)
                va = await squad.create_virtual_account(
                    user,
                    bvn=bvn_plain,
                    phone=phone_plain,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    middle_name=user.first_name,  # No middle_name column; reuse first
                    dob=dob_str,
                    gender="1",  # Default; not stored on User yet
                    address="Nigeria",
                )
                logger.info(
                    "retry_squad_provisioning_success",
                    user_id=user_id,
                    account_number=va.get("account_number"),
                )

    try:
        asyncio.run(_run())
        try:
            from src.workers.credit_tasks import update_activity_feed_cache
            update_activity_feed_cache.delay()
        except Exception as cache_err:
            logger.warning("squad_task.cache_invalidation_failed", error=str(cache_err))
    except Exception as exc:
        attempt = self.request.retries + 1
        countdown = 10 * (3 ** self.request.retries)
        err_str = str(exc)
        # Squad 4xx responses are permanent — retrying an invalid BVN every
        # 90s won't change the answer. Abandon early so we don't burn logs
        # and worker capacity.
        permanent_signals = (
            "invalid BVN",
            "invalid bvn",
            "Validation Failure",
            "is not allowed",
            "length must be",
            '-> 400',
            '-> 401',
            '-> 403',
            '-> 422',
        )
        is_permanent = any(s in err_str for s in permanent_signals)
        logger.error(
            "retry_squad_provisioning_attempt_failed",
            user_id=user_id,
            attempt=attempt,
            next_retry_in=None if is_permanent else countdown,
            error=err_str,
            permanent=is_permanent,
        )
        if is_permanent:
            logger.error(
                "retry_squad_provisioning_abandoned_permanent",
                user_id=user_id,
                error=err_str,
                hint=(
                    "Squad rejected the payload as invalid. In sandbox this "
                    "usually means the BVN isn't one of Squad's test values "
                    "(e.g. 22222222226). On live keys, any real BVN works."
                ),
            )
            return
        if self.request.retries >= self.max_retries:
            logger.error(
                "retry_squad_provisioning_exhausted",
                user_id=user_id,
                max_retries=self.max_retries,
            )
            return
        raise self.retry(exc=exc, countdown=countdown)


# ---------------------------------------------------------------------------- #
#  process_squad_webhook                                                        #
# ---------------------------------------------------------------------------- #

_VA_FUNDING = "va_funding"
_PAYOUT_SUCCESS = "payout_success"
_PAYOUT_FAILED = "payout_failed"
_UNKNOWN = "unknown"


def _classify_event(payload: dict) -> str:
    """
    Squad's webhook payloads do not share a single 'event_type' field across
    products. Detect the kind heuristically from the payload shape.
    """
    event = (
        str(payload.get("event") or payload.get("event_type") or "")
        .lower()
        .strip()
    )

    # Virtual account funding always carries a virtual_account_number and a
    # transaction_indicator ("C" for credit, "D" for debit / reversal).
    if payload.get("virtual_account_number"):
        return _VA_FUNDING

    if "transfer" in event or "payout" in event:
        if any(word in event for word in ("fail", "reverse", "decline", "error")):
            return _PAYOUT_FAILED
        if any(word in event for word in ("success", "complete", "processed", "settled")):
            return _PAYOUT_SUCCESS

    # Charge / payment via checkout
    if any(word in event for word in ("charge", "payment", "transaction")):
        if "fail" in event:
            return _PAYOUT_FAILED
        return _PAYOUT_SUCCESS

    return _UNKNOWN


def _amount_to_kobo(raw) -> int | None:
    """
    Squad amounts come in inconsistently:
      - VA funding payloads: principal_amount as a string in naira ("500.00")
      - Payout payloads: amount sometimes integer kobo, sometimes string naira
    Convert to integer kobo. Returns None if the value is unusable.
    """
    if raw is None:
        return None
    try:
        if isinstance(raw, int):
            # Heuristic: small ints are probably already kobo, but ambiguous.
            # VA webhook strings always have a decimal, so an int here is most
            # often a payout amount already in kobo.
            return raw
        d = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None
    # If the string had a decimal point, treat as naira → kobo
    if "." in str(raw):
        return int((d * 100).to_integral_value())
    # Otherwise assume kobo
    return int(d)


async def _handle_va_funding(db, payload: dict, webhook_id: str) -> dict:
    """
    Inbound credit to a customer VA. Squad payload (representative):
      {
        "transaction_reference": "REF_...",
        "virtual_account_number": "0123456789",
        "principal_amount": "500.00",
        "settled_amount": "490.00",
        "fee_charged": "10.00",
        "transaction_indicator": "C",
        "customer_identifier": "<user.id>",
        "sender_name": "...",
        "remarks": "...",
        "currency": "NGN",
        "channel": "virtual-account"
      }
    """
    from sqlalchemy import select
    from src.models import User, Transaction, SquadWebhookLog
    from src.models.base import TransactionType

    indicator = (payload.get("transaction_indicator") or "C").upper()
    if indicator != "C":
        logger.info("squad_webhook_va_non_credit_skipped", webhook_id=webhook_id, indicator=indicator)
        return {"skipped": True, "reason": "non-credit"}

    customer_identifier = payload.get("customer_identifier")
    user = None
    if customer_identifier:
        user = await db.scalar(select(User).where(User.id == customer_identifier))

    # Fall back to account-number match in case customer_identifier is missing
    if user is None:
        va_num = payload.get("virtual_account_number")
        if va_num:
            user = await db.scalar(select(User).where(User.squad_account_number == va_num))

    if user is None:
        logger.warning(
            "squad_webhook_va_user_not_found",
            webhook_id=webhook_id,
            customer_identifier=customer_identifier,
            account=payload.get("virtual_account_number"),
        )
        return {"skipped": True, "reason": "user_not_found"}

    reference = payload.get("transaction_reference") or webhook_id
    # Idempotency at the Transaction level too, in case the webhook id and the
    # transaction_reference are different (Squad does occasionally retry under
    # a fresh webhook id).
    existing = await db.scalar(select(Transaction).where(Transaction.squad_reference == reference))
    if existing:
        logger.info("squad_webhook_va_tx_exists", webhook_id=webhook_id, tx_id=existing.id)
        return {"skipped": True, "reason": "tx_exists", "tx_id": existing.id}

    gross_kobo = _amount_to_kobo(payload.get("principal_amount"))
    fee_kobo = _amount_to_kobo(payload.get("fee_charged")) or 0
    settled_kobo = _amount_to_kobo(payload.get("settled_amount"))
    amount_kobo = settled_kobo or (gross_kobo - fee_kobo if gross_kobo is not None else None)

    if amount_kobo is None:
        logger.error(
            "squad_webhook_va_unparseable_amount",
            webhook_id=webhook_id,
            principal=payload.get("principal_amount"),
            settled=payload.get("settled_amount"),
        )
        return {"skipped": True, "reason": "bad_amount"}

    tx = Transaction(
        sender_id=None,  # external sender
        receiver_id=user.id,
        transaction_type=TransactionType.CREDIT_DEPOSIT,
        amount=amount_kobo,
        amount_gross=gross_kobo,
        squad_fee=fee_kobo or None,
        squad_reference=reference,
        direction="credit",
        status="completed",
        method=payload.get("channel") or "virtual-account",
        tx_metadata={
            "sender_name": payload.get("sender_name"),
            "sender_account_number": payload.get("sender_account_number"),
            "remarks": payload.get("remarks"),
            "currency": payload.get("currency") or "NGN",
        },
    )
    db.add(tx)

    # Mark webhook log as processed
    log = await db.scalar(select(SquadWebhookLog).where(SquadWebhookLog.webhook_id == webhook_id))
    if log is not None:
        log.processed = True

    await db.commit()

    # Off the request path: recalc credit + invalidate activity feed cache
    try:
        from src.workers.credit_tasks import recalculate_pulse_score, update_activity_feed_cache
        recalculate_pulse_score.delay(user.id)
        update_activity_feed_cache.delay()
    except Exception as exc:
        logger.warning("squad_webhook_va_followup_dispatch_failed", error=str(exc))

    logger.info(
        "squad_webhook_va_funding_recorded",
        webhook_id=webhook_id,
        user_id=user.id,
        tx_id=tx.id,
        amount_kobo=amount_kobo,
    )

    # Per-transaction email receipt — receiver is the user who was credited.
    # Wrap in try/except so an SMTP/SendGrid outage cannot fail the webhook.
    try:
        from src.services.email_service import EmailService
        await EmailService().send_receipt(user.id, tx.id, db)
    except Exception as e:
        logger.error("email_receipt_failed", transaction_id=str(tx.id), error=str(e))

    return {"tx_id": tx.id, "user_id": user.id, "amount_kobo": amount_kobo}


async def _handle_payout_result(db, payload: dict, webhook_id: str, success: bool) -> dict:
    """
    Payout webhook from Squad — match the existing Transaction by
    squad_reference (we set this when we issued the transfer) and update
    status. Triggers a pulse score recalc on success since on-time loan or gig
    payouts feed into the repayment / completion signals.

    Also reconciles AjoTransaction rows when the Transaction is tagged with
    `ajo_transaction_id` in its metadata: on success, increments the group
    balance + member.total_contributed + user.ajo_savings_balance, all of
    which feed the Financial Discipline pulse signal.
    """
    from sqlalchemy import select
    from src.models import Transaction, SquadWebhookLog, AjoTransaction, AjoMembership, Ajo, User

    reference = (
        payload.get("transaction_reference")
        or payload.get("reference")
        or payload.get("transaction_ref")
    )
    if not reference:
        logger.warning("squad_webhook_payout_no_reference", webhook_id=webhook_id, keys=list(payload.keys()))
        return {"skipped": True, "reason": "no_reference"}

    tx = await db.scalar(select(Transaction).where(Transaction.squad_reference == reference))
    if tx is None:
        logger.warning("squad_webhook_payout_tx_not_found", webhook_id=webhook_id, reference=reference)
        return {"skipped": True, "reason": "tx_not_found"}

    new_status = "completed" if success else "failed"
    if tx.status == new_status:
        return {"skipped": True, "reason": "already_in_state", "status": new_status}

    tx.status = new_status
    meta = dict(tx.tx_metadata or {})
    meta["squad_webhook_id"] = webhook_id
    meta["squad_event"] = payload.get("event") or payload.get("event_type")
    if not success:
        meta["failure_reason"] = (
            payload.get("failure_reason")
            or payload.get("response_description")
            or payload.get("message")
        )
    tx.tx_metadata = meta

    # Reconcile Ajo contribution if this Transaction belongs to one.
    ajo_tx_id = (tx.tx_metadata or {}).get("ajo_transaction_id")
    ajo_reconciled = None
    if ajo_tx_id:
        ajo_tx = await db.scalar(select(AjoTransaction).where(AjoTransaction.id == ajo_tx_id))
        if ajo_tx and ajo_tx.status != new_status:
            ajo_tx.status = new_status
            if success:
                paid_at = datetime.now(timezone.utc)
                ajo_tx.paid_at = paid_at
                ajo = await db.scalar(select(Ajo).where(Ajo.id == ajo_tx.ajo_id))
                if ajo is not None:
                    # on_time: paid_at <= next_due_date if set, else end_date;
                    # if neither is set we leave on_time NULL (unknown) rather
                    # than defaulting to a value that would bias the score.
                    due = ajo.next_due_date or ajo.end_date
                    if due is not None:
                        if due.tzinfo is None:
                            due = due.replace(tzinfo=timezone.utc)
                        ajo_tx.on_time = paid_at <= due
                    ajo.total_balance = int(ajo.total_balance or 0) + int(ajo_tx.amount or 0)
                membership = await db.scalar(
                    select(AjoMembership).where(
                        AjoMembership.ajo_id == ajo_tx.ajo_id,
                        AjoMembership.user_id == ajo_tx.user_id,
                    )
                )
                if membership is not None:
                    membership.total_contributed = int(membership.total_contributed or 0) + int(ajo_tx.amount or 0)
                user = await db.scalar(select(User).where(User.id == ajo_tx.user_id))
                if user is not None:
                    user.ajo_savings_balance = int(user.ajo_savings_balance or 0) + int(ajo_tx.amount or 0)
                ajo_reconciled = {
                    "ajo_id": ajo_tx.ajo_id,
                    "ajo_transaction_id": ajo_tx.id,
                    "amount": int(ajo_tx.amount or 0),
                    "on_time": ajo_tx.on_time,
                }
                logger.info("squad_webhook_ajo_contribution_reconciled", **ajo_reconciled)

    log = await db.scalar(select(SquadWebhookLog).where(SquadWebhookLog.webhook_id == webhook_id))
    if log is not None:
        log.processed = True

    await db.commit()

    if success and tx.sender_id:
        # Outbound transfer cleared — pulse signals (loan repayment, gig
        # completion, Ajo savings) may depend on this. Recalc for the payer.
        try:
            from src.workers.credit_tasks import recalculate_pulse_score, update_activity_feed_cache
            recalculate_pulse_score.delay(tx.sender_id)
            update_activity_feed_cache.delay()
        except Exception as exc:
            logger.warning("squad_webhook_payout_followup_dispatch_failed", error=str(exc))

    logger.info(
        "squad_webhook_payout_processed",
        webhook_id=webhook_id,
        tx_id=tx.id,
        reference=reference,
        success=success,
        ajo_reconciled=bool(ajo_reconciled),
    )

    # Per-transaction email receipt — only for successful payouts. The party
    # whose balance changed is the sender (they paid out). Failed transfers
    # MUST NOT generate a receipt. Wrap so an email outage never derails the
    # webhook flow.
    if success and tx.sender_id:
        try:
            from src.services.email_service import EmailService
            await EmailService().send_receipt(tx.sender_id, tx.id, db)
        except Exception as e:
            logger.error("email_receipt_failed", transaction_id=str(tx.id), error=str(e))

    return {"tx_id": tx.id, "status": new_status, "ajo": ajo_reconciled}


@celery_app.task(
    bind=True,
    name="squad.process_squad_webhook",
    queue="critical",
    max_retries=2,
    default_retry_delay=30,
    acks_late=True,
    time_limit=30,
    soft_time_limit=20,
)
def process_squad_webhook(self, webhook_data: dict):
    """
    Process a Squad webhook payload off the request thread.

    The HTTP handler in routers/webhooks.py is responsible for:
      1. HMAC-SHA512 signature verification on raw body
      2. Idempotency claim in Redis (SET NX, 24h TTL)
      3. Persisting an initial webhook log (best-effort fallback)
      4. Returning 200 to Squad immediately

    By the time this task fires we are inside our own retry budget — Squad has
    already been acknowledged and will not redeliver.
    """

    async def _run():
        from src.core.database import async_session
        from src.core.redis_client import get_redis_cache
        from src.services.squad import SquadService

        webhook_id = (
            webhook_data.get("id")
            or webhook_data.get("transaction_ref")
            or webhook_data.get("transaction_reference")
        )
        event_type = (
            webhook_data.get("event")
            or webhook_data.get("event_type")
            or webhook_data.get("Event")
            or "unknown"
        )

        if not webhook_id:
            logger.error("squad_webhook_missing_id", payload=webhook_data)
            return

        async with async_session() as db:
            redis = await get_redis_cache()
            squad = SquadService(db=db, redis=redis)
            # Idempotent log persist — handles the case where the HTTP handler's
            # inline fallback didn't write because Celery dispatch succeeded.
            try:
                await squad.persist_webhook_log(str(webhook_id), event_type, webhook_data)
            except Exception as exc:
                # Most likely unique-violation on webhook_id; safe to continue.
                logger.info("squad_webhook_log_persist_skipped", webhook_id=webhook_id, error=str(exc))

            kind = _classify_event(webhook_data)
            logger.info("squad_webhook_classified", webhook_id=webhook_id, kind=kind, event_type=event_type)

            if kind == _VA_FUNDING:
                await _handle_va_funding(db, webhook_data, str(webhook_id))
            elif kind == _PAYOUT_SUCCESS:
                await _handle_payout_result(db, webhook_data, str(webhook_id), success=True)
            elif kind == _PAYOUT_FAILED:
                await _handle_payout_result(db, webhook_data, str(webhook_id), success=False)
            else:
                logger.warning(
                    "squad_webhook_unhandled_event",
                    webhook_id=webhook_id,
                    event_type=event_type,
                )

    try:
        asyncio.run(_run())
    except Exception as exc:
        logger.error(
            "process_squad_webhook_failed",
            error=str(exc),
            payload=webhook_data,
        )
        raise self.retry(exc=exc)
