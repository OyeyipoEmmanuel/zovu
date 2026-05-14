"""
Credit scoring and recalculation tasks.
CRITICAL: Do NOT call credit recalculation synchronously from routes.
"""
from src.workers.celery_app import celery_app
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models import User, PulseScore
import structlog
import asyncio
from celery import shared_task

logger = structlog.get_logger()


@shared_task(queue="low", name="workers.credit_tasks.update_activity_feed_cache")
def update_activity_feed_cache() -> dict:
    """Invalidate Redis activity feed cache keys after credit or transaction updates."""
    async def _run():
        try:
            from src.core.redis_client import redis_client
            redis = await redis_client.get_pool(0)
            keys = await redis.keys("activity_feed:*")
            if keys:
                await redis.delete(*keys)
            logger.info("activity_feed_cache_invalidated", count=len(keys))
            return {"deleted": len(keys)}
        except Exception as e:
            logger.warning("activity_feed_cache_invalidation_failed", error=str(e))
            return {"deleted": 0}
    return asyncio.run(_run())


@celery_app.task(
    bind=True,
    queue="default",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def recalculate_pulse_score(self, user_id: str):
    """
    Recalculate user's pulse score based on 6 signals.
    Runs async in background — never called from request path.
    
    Signals (all 0-100 before weighting):
    1. Employment Stability (weight=0.20): tenure, income stability
    2. Income Score (weight=0.20): monthly income amount
    3. Repayment History (weight=0.25): on-time repayments, defaults
    4. Ajo Participation (weight=0.15): group savings history
    5. Referral Quality (weight=0.10): quality of referrals
    6. Fraud Risk (weight=0.10): inverted (lower is worse)
    
    Total = sum(signal * weight) * 10 = 0-850 range
    """
    logger.info("pulse_score_recalculation_started", user_id=user_id)
    
    try:
        # Signal calculations would happen here
        # This is a placeholder
        logger.info("pulse_score_recalculated", user_id=user_id, score=650)
        return {"user_id": user_id, "score": 650}
    except Exception as exc:
        logger.error("pulse_score_recalculation_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    queue="critical",
    max_retries=2,
)
def check_loan_due_dates(self):
    """Check for due loans and take action (soft-freeze + notification)."""
    logger.info("loan_due_date_check_started")
    # Placeholder
    return {"checked": True}


@celery_app.task(
    bind=True,
    queue="default",
    max_retries=3,
)
def mark_loan_defaulted(self, loan_id: str):
    """Mark loan as defaulted (soft-freeze user)."""
    logger.info("marking_loan_defaulted", loan_id=loan_id)
    # Placeholder
    return {"loan_id": loan_id, "status": "defaulted"}
