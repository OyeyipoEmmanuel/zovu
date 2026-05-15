"""
Webhooks router — Squad webhook receiver with idempotency and signature verification.

Flow (matches the master-reference spec):
  1. Read raw body (HMAC needs exact bytes)
  2. Verify HMAC-SHA512 with SQUAD_SECRET_KEY
  3. Parse JSON
  4. Atomically claim the webhook id in Redis (SET NX EX 86400)
  5. Hand the payload to the `critical` Celery queue
  6. Return 200 immediately

We never block Squad on DB or business logic. Squad's redelivery window is
short and they treat anything but a fast 200 as a failure.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from src.core.database import get_db
from src.core.redis_client import get_redis_cache
from src.services.squad import SquadService
import structlog
import json

logger = structlog.get_logger()

router = APIRouter()


@router.post(
    "/squad",
    response_model=dict,
    tags=["Webhooks"],
    summary="Squad Webhook",
    description="Receive Squad webhook events (idempotent, async-processed)",
)
async def squad_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
    x_squadco_signature: str = Header(None, alias="X-Squad-Encrypted-Body"),
    x_squad_signature_legacy: str = Header(None, alias="X-SquadCo-Signature"),
):
    """
    Squad webhook entrypoint. Always returns 200 once the signature checks out
    so Squad doesn't retry — actual processing happens in Celery.
    """
    # Squad has used two header names over time; accept either.
    signature = x_squadco_signature or x_squad_signature_legacy

    body = await request.body()

    if not signature:
        logger.warning("webhook_missing_signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing signature",
        )

    squad_service = SquadService(db=db, redis=redis)
    if not squad_service.verify_webhook_signature(body, signature):
        logger.error("webhook_signature_verification_failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature",
        )

    try:
        webhook_data = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        logger.error("webhook_invalid_json", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    webhook_id = (
        webhook_data.get("id")
        or webhook_data.get("transaction_ref")
        or webhook_data.get("transaction_reference")
    )
    if not webhook_id:
        logger.warning("webhook_missing_id", payload_keys=list(webhook_data.keys()))
        # Still return 200 — Squad would just retry forever on a 4xx for this
        return {"status": "ignored", "reason": "no_webhook_id"}

    is_new = await squad_service.claim_webhook_idempotency(str(webhook_id))
    if not is_new:
        logger.info("webhook_already_processed", webhook_id=webhook_id)
        return {"status": "duplicate", "webhook_id": webhook_id}

    # Offload to Celery. If Celery is unavailable (dev without worker), fall
    # back to inline processing so the webhook isn't silently dropped.
    try:
        from src.workers.squad_tasks import process_squad_webhook
        process_squad_webhook.apply_async(
            args=[webhook_data],
            queue="critical",
        )
        logger.info("webhook_queued", webhook_id=webhook_id)
    except Exception as exc:
        logger.warning(
            "webhook_celery_dispatch_failed_processing_inline",
            webhook_id=webhook_id,
            error=str(exc),
        )
        event_type = (
            webhook_data.get("event")
            or webhook_data.get("event_type")
            or "unknown"
        )
        try:
            await squad_service.persist_webhook_log(str(webhook_id), event_type, webhook_data)
        except Exception as log_exc:
            logger.error("webhook_inline_persist_failed", error=str(log_exc))

    return {"status": "accepted", "webhook_id": webhook_id}
