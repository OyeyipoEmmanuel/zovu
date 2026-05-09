"""
Squad API integration tasks (virtual accounts, transfers, webhooks).
"""
from src.workers.celery_app import celery_app
import structlog
import httpx

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    queue="critical",
    max_retries=2,
    time_limit=30,
)
def process_squad_transfer(self, transaction_id: str, amount: int, recipient_squad_id: str):
    """
    Process transfer via Squad API.
    Amount in KOBO.
    Critical queue — timeout 30s, max 2 retries.
    """
    logger.info("squad_transfer_started", transaction_id=transaction_id, amount=amount)
    try:
        # Call Squad API
        # This is a placeholder
        logger.info("squad_transfer_completed", transaction_id=transaction_id)
        return {"transaction_id": transaction_id, "status": "transferred"}
    except Exception as exc:
        logger.error("squad_transfer_failed", transaction_id=transaction_id, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    queue="critical",
    max_retries=2,
)
def create_squad_virtual_account(self, user_id: str, email: str):
    """
    Create virtual account on Squad for user.
    Called once during KYC verification.
    """
    logger.info("squad_virtual_account_creation_started", user_id=user_id)
    try:
        # Call Squad API
        logger.info("squad_virtual_account_created", user_id=user_id)
        return {"user_id": user_id, "squad_id": "some_id"}
    except Exception as exc:
        logger.error("squad_virtual_account_creation_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    queue="default",
)
def process_squad_webhook_async(self, webhook_id: str, event_type: str, payload: dict):
    """
    Async webhook processing (idempotency check already done in route).
    Process transfer confirmations, balance updates, etc.
    """
    logger.info("squad_webhook_processing", webhook_id=webhook_id, event_type=event_type)
    # Placeholder
    return {"webhook_id": webhook_id, "processed": True}
