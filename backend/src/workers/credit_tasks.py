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


async def _invalidate_partner_recs_cache(user_id: str) -> None:
    """Delete the `recs:{user_id}` partner-recommendations cache key.

    Called from `recalculate_pulse_score` whenever a user's tier changes,
    so the next GET /partner-recommendations/{userId} rebuilds the list
    against the new eligibility.
    """
    try:
        from src.core.redis_client import redis_client
        redis = await redis_client.get_pool(0)
        await redis.delete(f"recs:{user_id}")
        logger.info("partner_recs_cache_invalidated", user_id=user_id)
    except Exception as exc:
        logger.warning("partner_recs_cache_invalidate_failed", user_id=user_id, error=str(exc))


async def _fetch_user_score_and_tier(user_id: str) -> tuple[int | None, str | None]:
    """Read the user's current pulse_score → (score, tier) tuple, or (None, None)."""
    from src.core.database import async_session
    from src.core.utils import get_pulse_tier
    try:
        async with async_session() as session:
            row = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
            if not row:
                return None, None
            score = int(row.pulse_score or 0)
            return score, get_pulse_tier(score)
    except Exception as exc:
        logger.warning("partner_recs_tier_fetch_failed", user_id=user_id, error=str(exc))
        return None, None


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

    Side effect: if the recalc moves the user into a new tier
    (Bronze/Silver/Gold/Platinum), the partner-recommendations Redis cache
    `recs:{user_id}` is invalidated so the next dashboard load re-runs the
    eligibility filter against the new score.
    """
    logger.info("pulse_score_recalculation_started", user_id=user_id)

    async def _run() -> dict:
        # 1) Capture the tier *before* we touch the score.
        _old_score, old_tier = await _fetch_user_score_and_tier(user_id)

        # 2) Signal calculations would happen here — placeholder for now.
        score = 650

        # 3) Compare the new tier to the pre-recalc tier. Even though this
        #    worker hasn't yet persisted a score, we still treat a *computed*
        #    tier change as a reason to bust the recs cache so subsequent
        #    reads pick up the most recent eligibility.
        from src.core.utils import get_pulse_tier
        new_tier = get_pulse_tier(score)
        if old_tier is not None and new_tier != old_tier:
            await _invalidate_partner_recs_cache(user_id)

        logger.info(
            "pulse_score_recalculated",
            user_id=user_id,
            score=score,
            old_tier=old_tier,
            new_tier=new_tier,
        )
        return {"user_id": user_id, "score": score, "tier": new_tier}

    try:
        return asyncio.run(_run())
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
