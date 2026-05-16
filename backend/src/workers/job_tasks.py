"""
Job-related Celery tasks:
  - notify_matching_seekers: find matched seekers when a gig is posted, send emails
  - process_gig_payout: process payout to seeker when gig is completed
"""
import asyncio
import uuid
from datetime import datetime, timezone

import httpx
import structlog
from src.workers.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(queue="default", bind=True, max_retries=3, default_retry_delay=60)
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


@celery_app.task(queue="critical", bind=True, max_retries=3, default_retry_delay=30)
def process_gig_payout(self, gig_id: str) -> dict:
    """
    Process payout to seeker when a gig is completed.
    Creates a CREDIT_DEPOSIT transaction for the seeker.
    """
    return asyncio.run(_process_gig_payout_async(gig_id))


async def _process_gig_payout_async(gig_id: str) -> dict:
    from sqlalchemy import select
    from src.core.database import async_session
    from src.models.base import Gig, GigApplication, GigStatus, Transaction, TransactionType, JobRecommendation
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

        app = await session.scalar(
            select(GigApplication).where(
                GigApplication.gig_id == gig_id,
                GigApplication.seeker_id == gig.seeker_id,
                GigApplication.status == "trader_confirmed",
            )
        )
        if not app:
            logger.warning("gig_payout.application_not_confirmed", gig_id=gig_id)
            return {"status": "skipped"}

        from src.models.base import User
        seeker = await session.get(User, gig.seeker_id)
        if not seeker or not seeker.squad_account_number:
            logger.warning("gig_payout.seeker_va_missing", gig_id=gig_id, seeker_id=gig.seeker_id)
            return {"status": "skipped", "reason": "seeker VA missing"}

        amount = int(app.reserved_amount or gig.amount or 0)
        reference = f"zovu-gigpay-{uuid.uuid4().hex}"
        txn = Transaction(
            id=str(uuid.uuid4()),
            sender_id=gig.trader_id,
            receiver_id=gig.seeker_id,
            transaction_type=TransactionType.CREDIT_WITHDRAWAL,
            direction="credit",
            amount=amount,
            amount_gross=amount,
            status="pending",
            method="squad_transfer",
            squad_reference=reference,
            tx_metadata={
                "source": "gig_payout",
                "purpose": "trader_to_seeker_payout",
                "gig_id": gig_id,
                "application_id": app.id,
                "trader_id": gig.trader_id,
                "seeker_id": gig.seeker_id,
            },
        )
        session.add(txn)
        await session.flush()

        try:
            from src.services.squad import SquadService, SQUAD_BANK_CODE_TO_NAME
            bank_code = ""
            for code, name in SQUAD_BANK_CODE_TO_NAME.items():
                if name.lower() == (seeker.squad_account_bank or "").lower():
                    bank_code = code
                    break
            if not bank_code:
                bank_code = "058"

            async with httpx.AsyncClient(timeout=30.0) as http:
                squad = SquadService(db=session, redis=None, http=http)
                result = await squad.transfer_funds(
                    recipient_account=seeker.squad_account_number,
                    bank_code=bank_code,
                    amount_kobo=amount,
                    reference=reference,
                    narration=f"Zovu job payout for {gig.title}"[:90],
                )
            txn.status = "completed" if (result.get("status") or "").lower() in ("success", "successful", "completed") else "processing"
            meta = dict(txn.tx_metadata or {})
            meta["squad_transaction_id"] = result.get("squad_transaction_id")
            meta["squad_status"] = result.get("status")
            meta["nip_session_id"] = result.get("nip_session_id")
            txn.tx_metadata = meta
        except Exception as e:
            txn.status = "failed"
            meta = dict(txn.tx_metadata or {})
            meta["error"] = str(e)
            txn.tx_metadata = meta
            logger.error("gig_payout.squad_transfer_failed", gig_id=gig_id, error=str(e))

        await session.execute(
            update(JobRecommendation)
            .where(JobRecommendation.gig_id == gig_id)
            .values(applied=True)
        )

        await session.commit()
        logger.info("gig_payout.done", gig_id=gig_id, amount=amount, seeker_id=gig.seeker_id, status=txn.status)

        try:
            from src.workers.credit_tasks import update_activity_feed_cache
            update_activity_feed_cache.delay()
        except Exception as e:
            logger.warning("gig_payout.cache_invalidation_failed", error=str(e))

        return {"status": "ok", "transaction_id": txn.id}


@celery_app.task(queue="default", bind=True, max_retries=3, default_retry_delay=60)
def check_job_confirmation_deadline(self, application_id: str) -> dict:
    """Move stale worker_done applications into dispute after the 24h deadline."""
    return asyncio.run(_check_job_confirmation_deadline_async(application_id))


async def _check_job_confirmation_deadline_async(application_id: str) -> dict:
    from sqlalchemy import select
    from src.core.database import async_session
    from src.models.base import GigApplication, Gig, SupportTicket

    async with async_session() as session:
        q = (
            select(GigApplication, Gig)
            .join(Gig, Gig.id == GigApplication.gig_id)
            .where(GigApplication.id == application_id)
        )
        row = (await session.execute(q)).one_or_none()
        if not row:
            logger.warning("job_deadline.application_not_found", application_id=application_id)
            return {"status": "skipped", "reason": "not found"}

        app, gig = row
        if app.status != "worker_done":
            logger.info("job_deadline.noop", application_id=application_id, status=app.status)
            return {"status": "noop", "application_status": app.status}

        app.status = "in_dispute"
        existing_ticket = await session.scalar(
            select(SupportTicket).where(
                SupportTicket.type == "job_timeout",
                SupportTicket.reference_id == application_id,
            )
        )
        if not existing_ticket:
            session.add(
                SupportTicket(
                    id=str(uuid.uuid4()),
                    type="job_timeout",
                    reference_id=application_id,
                    status="open",
                    notes="Trader did not confirm or dispute within 24 hours.",
                )
            )

        await session.commit()
        logger.info(
            "job_deadline.in_dispute",
            application_id=application_id,
            channel_trader=f"jobs:{gig.trader_id}",
            channel_seeker=f"jobs:{app.seeker_id}",
        )
        return {"status": "in_dispute", "application_id": application_id}


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
