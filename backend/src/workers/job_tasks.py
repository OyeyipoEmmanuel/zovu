"""
Job-related Celery tasks:
  - notify_matching_seekers: find matched seekers when a gig is posted, send emails
  - process_gig_payout: process payout to seeker when gig is completed
"""
import asyncio
import uuid
from datetime import datetime, timezone

import structlog
from celery import shared_task

logger = structlog.get_logger()


@shared_task(queue="default", bind=True, max_retries=3, default_retry_delay=60)
def notify_matching_seekers(self, gig_id: str) -> dict:
    """
    Find seekers whose skills match the gig, create JobRecommendation rows,
    and send email notifications.
    """
    return asyncio.run(_notify_matching_seekers_async(gig_id))


async def _notify_matching_seekers_async(gig_id: str) -> dict:
    from sqlalchemy import select
    from src.core.database import async_session
    from src.models.base import Gig, User, UserType, Credit, JobRecommendation
    from src.services.email_service import EmailService
    from src.config import settings
    import json

    async with async_session() as session:
        gig_q = select(Gig).where(Gig.id == gig_id)
        gig = (await session.execute(gig_q)).scalar_one_or_none()
        if not gig:
            logger.warning("notify_seekers.gig_not_found", gig_id=gig_id)
            return {"status": "skipped", "reason": "gig not found"}

        # Check if recommendations already sent
        existing_q = select(JobRecommendation).where(JobRecommendation.gig_id == gig_id).limit(1)
        if (await session.execute(existing_q)).scalar_one_or_none():
            logger.info("notify_seekers.already_sent", gig_id=gig_id)
            return {"status": "skipped", "reason": "already sent"}

        seekers_q = select(User, Credit).join(
            Credit, Credit.user_id == User.id, isouter=True
        ).where(
            User.user_type.in_([UserType.SEEKER]),
        )
        rows = (await session.execute(seekers_q)).all()

        email_svc = EmailService()
        sent_count = 0
        created_count = 0

        for user, credit in rows:
            pulse_score = (credit.pulse_score or 0) if credit else 0
            if pulse_score < 30:
                continue

            seeker_skills = user.skills_list or []
            if isinstance(seeker_skills, str):
                try:
                    seeker_skills = json.loads(seeker_skills)
                except Exception:
                    seeker_skills = []

            match_tags = []
            synergy_score = 0.0

            if gig.skill_required and seeker_skills:
                gig_skill = gig.skill_required.lower()
                for skill in seeker_skills:
                    if gig_skill in skill.lower() or skill.lower() in gig_skill:
                        match_tags.append(f"Skill: {skill}")
                        synergy_score += 40.0
                        break

            if gig.location and user.location:
                if gig.location.lower() in user.location.lower() or user.location.lower() in gig.location.lower():
                    match_tags.append(f"Location: {gig.location}")
                    synergy_score += 30.0

            synergy_score += min(30.0, pulse_score / 30.0)
            synergy_score = min(100.0, synergy_score)

            if synergy_score < 30:
                continue

            rec = JobRecommendation(
                id=str(uuid.uuid4()),
                seeker_id=user.id,
                gig_id=gig_id,
                synergy_score=synergy_score,
                match_tags=match_tags,
                email_sent=False,
                viewed=False,
                applied=False,
            )
            session.add(rec)
            await session.flush()
            created_count += 1

            if settings.ENVIRONMENT == "production" and user.email:
                try:
                    await email_svc._send(
                        user.email,
                        f"New gig match: {gig.title}",
                        _job_match_html(
                            user.first_name or "there",
                            gig.title,
                            gig.skill_required,
                            gig.location,
                            gig.amount,
                            settings.FRONTEND_URL,
                            gig_id,
                        ),
                    )
                    rec.email_sent = True
                    rec.email_sent_at = datetime.now(timezone.utc)
                    sent_count += 1
                except Exception as e:
                    logger.warning("notify_seekers.email_failed", user_id=user.id, error=str(e))

        await session.commit()
        logger.info("notify_seekers.done", gig_id=gig_id, created=created_count, emails_sent=sent_count)
        return {"status": "ok", "created": created_count, "emails_sent": sent_count}


@shared_task(queue="critical", bind=True, max_retries=3, default_retry_delay=30)
def process_gig_payout(self, gig_id: str) -> dict:
    """
    Process payout to seeker when a gig is completed.
    Creates a CREDIT_DEPOSIT transaction for the seeker.
    """
    return asyncio.run(_process_gig_payout_async(gig_id))


async def _process_gig_payout_async(gig_id: str) -> dict:
    from sqlalchemy import select
    from src.core.database import async_session
    from src.models.base import Gig, GigStatus, Transaction, TransactionType, JobRecommendation
    from sqlalchemy import update

    async with async_session() as session:
        gig_q = select(Gig).where(Gig.id == gig_id)
        gig = (await session.execute(gig_q)).scalar_one_or_none()
        if not gig:
            logger.warning("gig_payout.gig_not_found", gig_id=gig_id)
            return {"status": "skipped"}

        if gig.status != GigStatus.COMPLETED or not gig.seeker_id:
            logger.warning("gig_payout.not_ready", gig_id=gig_id, status=gig.status)
            return {"status": "skipped"}

        txn = Transaction(
            id=str(uuid.uuid4()),
            sender_id=gig.trader_id,
            receiver_id=gig.seeker_id,
            transaction_type=TransactionType.CREDIT_DEPOSIT,
            direction="credit",
            amount=gig.amount,
            status="completed",
            tx_metadata={"source": "gig_payout", "gig_id": gig_id},
        )
        session.add(txn)

        await session.execute(
            update(JobRecommendation)
            .where(JobRecommendation.gig_id == gig_id)
            .values(applied=True)
        )

        await session.commit()
        logger.info("gig_payout.done", gig_id=gig_id, amount=gig.amount, seeker_id=gig.seeker_id)

        try:
            from src.workers.credit_tasks import update_activity_feed_cache
            update_activity_feed_cache.delay()
        except Exception as e:
            logger.warning("gig_payout.cache_invalidation_failed", error=str(e))

        return {"status": "ok", "transaction_id": txn.id}


def _job_match_html(user_name: str, title: str, skill: str, location: str,
                    amount: int, frontend_url: str, gig_id: str) -> str:
    naira = amount / 100
    return f"""
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h1 style="color:#1A6B4A;font-size:22px;">New Job Match on Zovu!</h1>
    <p>Hi {user_name}, a gig matching your skills is now available:</p>
    <div style="background:#f0fff8;border-radius:6px;padding:16px;margin:16px 0;">
      <h2 style="margin:0 0 8px;color:#1a1a2e;">{title}</h2>
      <p style="margin:4px 0;color:#555;">Skill: <strong>{skill}</strong></p>
      <p style="margin:4px 0;color:#555;">Location: {location}</p>
      <p style="margin:4px 0;color:#1A6B4A;font-size:20px;font-weight:bold;">₦{naira:,.0f}</p>
    </div>
    <a href="{frontend_url}/dashboard/job-seeker/jobs"
       style="display:inline-block;background:#1A6B4A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
      View & Apply
    </a>
    <p style="color:#aaa;font-size:12px;margin-top:24px;">&copy; 2025 Zovu. All rights reserved.</p>
  </div>
</body>
</html>"""
