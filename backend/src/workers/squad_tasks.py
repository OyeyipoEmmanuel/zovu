"""
Squad-related Celery tasks.
retry_squad_provisioning: critical queue, exponential backoff, max 5 retries.
"""
from src.workers.celery_app import celery_app
import structlog
import asyncio

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    name="squad.retry_squad_provisioning",
    queue="critical",
    max_retries=5,
    default_retry_delay=60,
)
def retry_squad_provisioning(self, user_id: str):
    """
    Retry Squad virtual account creation after initial failure.
    Exponential backoff: 10s, 30s, 90s, 270s, 810s (max ~30 min total).
    On final failure, marks squad_provisioned=False permanently.
    """
    import httpx

    async def _run():
        from src.core.database import async_session
        from src.core.redis_client import get_redis_blacklist
        from src.services.squad import SquadService
        from src.models import User
        from sqlalchemy import select

        async with async_session() as db:
            redis = await get_redis_blacklist()
            user = await db.scalar(select(User).where(User.id == user_id))
            if not user:
                logger.error("retry_squad_provisioning_user_not_found", user_id=user_id)
                return

            if user.squad_provisioned:
                logger.info("retry_squad_provisioning_already_done", user_id=user_id)
                return

            async with httpx.AsyncClient(timeout=30.0) as http:
                squad = SquadService(http=http, db=db, redis=redis)
                va = await squad.create_virtual_account(user)
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
        # Exponential backoff: 10 * 3^attempt seconds
        countdown = 10 * (3 ** self.request.retries)
        logger.error(
            "retry_squad_provisioning_attempt_failed",
            user_id=user_id,
            attempt=attempt,
            next_retry_in=countdown,
            error=str(exc),
        )
        if self.request.retries >= self.max_retries:
            logger.error(
                "retry_squad_provisioning_exhausted",
                user_id=user_id,
                max_retries=self.max_retries,
            )
            return
        raise self.retry(exc=exc, countdown=countdown)
