"""
GigService — business logic for gig lifecycle.
"""
import math
import uuid
import structlog
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, or_

from src.config import settings
from src.models.base import Gig, GigApplication, GigStatus, User, UserType

logger = structlog.get_logger()

WAITING_FOR_WORKER = "waiting_for_worker"
WORKER_DONE = "worker_done"
TRADER_CONFIRMED = "trader_confirmed"
TRADER_DISPUTED = "trader_disputed"
IN_DISPUTE = "in_dispute"


class GigService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Create ──────────────────────────────────────────────────────────────

    async def create_gig(self, trader: User, payload: dict) -> Gig:
        """Create a new open gig. Trader role required."""
        _require_trader(trader)

        amount_kobo = int(payload.get("amount", 0))
        if amount_kobo <= 0:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=400, code="INVALID_AMOUNT",
                               message="amount must be a positive kobo integer")

        gig = Gig(
            id=str(uuid.uuid4()),
            trader_id=trader.id,
            seeker_id=None,
            title=payload.get("title", ""),
            description=payload.get("description"),
            skill_required=payload.get("skill_required", ""),
            payment_period=payload.get("payment_period"),
            location=payload.get("location", ""),
            direct_location=payload.get("direct_location"),
            scheduled_at=payload.get("scheduled_at"),
            amount=amount_kobo,
            status=GigStatus.OPEN,
        )
        self.db.add(gig)
        await self.db.flush()

        try:
            from src.workers.job_tasks import notify_matching_seekers
            notify_matching_seekers.apply_async(args=[gig.id], queue="default")
        except Exception as e:
            logger.warning("gig.notify_task_failed", gig_id=gig.id, error=str(e))

        return gig

    # ── List ────────────────────────────────────────────────────────────────

    async def list_open_gigs(self, limit: int = 20, cursor_id: str | None = None,
                             skill: str | None = None, location: str | None = None) -> list[Gig]:
        """Return OPEN gigs with optional cursor + filters."""
        conditions = [Gig.status == GigStatus.OPEN]
        if cursor_id:
            conditions.append(Gig.id < cursor_id)
        if skill:
            conditions.append(Gig.skill_required.ilike(f"%{skill}%"))
        if location:
            conditions.append(Gig.location.ilike(f"%{location}%"))

        q = (select(Gig).where(and_(*conditions))
             .order_by(desc(Gig.created_at))
             .limit(limit))
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_my_gigs(self, trader: User) -> list[Gig]:
        """Trader's own gigs across all statuses."""
        _require_trader(trader)
        q = select(Gig).where(Gig.trader_id == trader.id).order_by(desc(Gig.created_at))
        result = await self.db.execute(q)
        return list(result.scalars().all())

    # ── Get ─────────────────────────────────────────────────────────────────

    async def get_gig(self, gig_id: str) -> Gig:
        result = await self.db.execute(select(Gig).where(Gig.id == gig_id))
        gig = result.scalar_one_or_none()
        if not gig:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=404, code="GIG_NOT_FOUND", message="Gig not found")
        return gig

    # ── Apply ────────────────────────────────────────────────────────────────

    async def apply_to_gig(self, seeker: User, gig_id: str) -> GigApplication:
        """Seeker applies to a gig.

        The row is created in `pending` — money is *not* reserved here; that
        happens in `accept_applicant` once the trader picks this seeker. This
        keeps the existing applicant-pool UX (many can apply, trader picks
        one) and only kicks off the escrow state machine on accept.

        The spec's literal "/listings/:id/apply → waiting_for_worker + money
        reserved" assumes a one-applicant-per-gig auto-accept model. If we
        moved straight to waiting_for_worker here, the second applicant would
        get `GIG_NOT_OPEN`, and the existing trader Accept UI would error.
        """
        _require_seeker(seeker)
        gig = await self.get_gig(gig_id)

        if gig.status != GigStatus.OPEN:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=409, code="GIG_NOT_OPEN", message="Gig is not accepting applications")

        existing_q = select(GigApplication).where(
            and_(GigApplication.gig_id == gig_id, GigApplication.seeker_id == seeker.id)
        )
        existing = (await self.db.execute(existing_q)).scalar_one_or_none()
        if existing:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=409, code="ALREADY_APPLIED", message="You have already applied to this gig")

        application = GigApplication(
            id=str(uuid.uuid4()),
            gig_id=gig_id,
            seeker_id=seeker.id,
            status="pending",
        )
        self.db.add(application)
        await self.db.flush()
        return application

    # ── Applicants ──────────────────────────────────────────────────────────

    async def list_applicants(self, trader: User, gig_id: str) -> list[GigApplication]:
        """Trader lists applicants for their gig."""
        _require_trader(trader)
        gig = await self.get_gig(gig_id)
        if gig.trader_id != trader.id:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your gig")

        q = select(GigApplication).where(GigApplication.gig_id == gig_id).order_by(desc(GigApplication.applied_at))
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_applicants_with_seekers(self, trader: User, gig_id: str) -> list[dict]:
        """Trader lists applicants enriched with seeker profile data."""
        _require_trader(trader)
        gig = await self.get_gig(gig_id)
        if gig.trader_id != trader.id:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your gig")

        q = (
            select(GigApplication, User)
            .join(User, User.id == GigApplication.seeker_id)
            .where(GigApplication.gig_id == gig_id)
            .order_by(desc(GigApplication.applied_at))
        )
        rows = (await self.db.execute(q)).all()
        out: list[dict] = []
        for app, seeker in rows:
            display_name = (
                (seeker.full_name or "").strip()
                or f"{(seeker.first_name or '').strip()} {(seeker.last_name or '').strip()}".strip()
                or seeker.email
            )
            skills = seeker.skills_list if isinstance(seeker.skills_list, list) else []
            languages = seeker.languages_spoken if isinstance(seeker.languages_spoken, list) else []
            out.append({
                "id": app.id,
                "gig_id": app.gig_id,
                "seeker_id": app.seeker_id,
                "status": app.status,
                "applied_at": app.applied_at.isoformat() if app.applied_at else None,
                "seeker": {
                    "id": seeker.id,
                    "display_name": display_name,
                    "email": seeker.email,
                    "pulse_score": int(getattr(seeker, "pulse_score", 0) or 0),
                    "location": seeker.location or "",
                    "skills": skills,
                    "languages": languages,
                    "completion_rate": float(getattr(seeker, "completion_rate", 0.0) or 0.0),
                    "kyc_verified": bool(getattr(seeker, "kyc_verified", False)),
                    "squad_account_number": seeker.squad_account_number,
                    "squad_account_bank": seeker.squad_account_bank,
                },
            })
        return out

    # ── Accept ───────────────────────────────────────────────────────────────

    async def accept_applicant(
        self,
        trader: User,
        gig_id: str,
        application_id: str,
        seeker_lat: float | None = None,
        seeker_lng: float | None = None,
    ) -> Gig:
        """Trader accepts an applicant — gig moves to IN_PROGRESS.

        Task 9 — geolocation phone reveal: when the seeker's current GPS is
        provided and the trader has stored GPS coordinates, compute the
        haversine distance. If it's within `settings.GEOLOCATION_PHONE_REVEAL_KM`,
        decrypt the trader's phone (Fernet) and append it to the application's
        `note` field. The decrypted phone is *never* returned in the API
        response — it only travels via the note column.
        """
        _require_trader(trader)
        gig = await self.get_gig(gig_id)
        if gig.trader_id != trader.id:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your gig")
        if gig.status != GigStatus.OPEN:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=409, code="GIG_NOT_OPEN", message="Gig is not open")

        app_q = select(GigApplication).where(
            and_(GigApplication.id == application_id, GigApplication.gig_id == gig_id)
        )
        app = (await self.db.execute(app_q)).scalar_one_or_none()
        if not app:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=404, code="APPLICATION_NOT_FOUND", message="Application not found")

        app.status = WAITING_FOR_WORKER
        app.reserved_amount = gig.amount
        gig.seeker_id = app.seeker_id
        gig.status = GigStatus.IN_PROGRESS
        gig.accepted_at = datetime.now(timezone.utc)

        reject_q = select(GigApplication).where(
            and_(GigApplication.gig_id == gig_id, GigApplication.id != application_id)
        )
        others = (await self.db.execute(reject_q)).scalars().all()
        for other in others:
            other.status = "rejected"

        # Task 9 — geolocation phone reveal.
        await self._maybe_append_trader_phone_to_note(
            trader=trader,
            application=app,
            seeker_lat=seeker_lat,
            seeker_lng=seeker_lng,
        )

        await self.db.flush()
        return gig

    async def _maybe_append_trader_phone_to_note(
        self,
        trader: User,
        application: GigApplication,
        seeker_lat: float | None,
        seeker_lng: float | None,
    ) -> None:
        """If seeker is within the configured radius, append the trader's phone
        to the application note. Otherwise: no-op (phone is never exposed).
        """
        if seeker_lat is None or seeker_lng is None:
            return
        t_lat = getattr(trader, "location_lat", None)
        t_lng = getattr(trader, "location_lng", None)
        if t_lat is None or t_lng is None:
            return
        if not trader.phone:
            return

        try:
            distance_km = _haversine_km(
                float(seeker_lat), float(seeker_lng), float(t_lat), float(t_lng)
            )
        except (TypeError, ValueError) as exc:
            logger.warning(
                "geo_phone_reveal_bad_coords",
                application_id=application.id,
                error=str(exc),
            )
            return

        threshold_km = float(settings.GEOLOCATION_PHONE_REVEAL_KM)
        if distance_km > threshold_km:
            logger.info(
                "geo_phone_reveal_skipped_out_of_range",
                application_id=application.id,
                distance_km=round(distance_km, 3),
                threshold_km=threshold_km,
            )
            return

        try:
            from src.core.security import decrypt_pii
            phone_plain = decrypt_pii(trader.phone)
        except Exception as exc:
            logger.warning(
                "geo_phone_reveal_decrypt_failed",
                application_id=application.id,
                error=str(exc),
            )
            return

        existing_note = application.note or ""
        contact_line = f"Contact trader: {phone_plain}"
        # Guard against double-append if accept is retried.
        if contact_line in existing_note:
            return
        if existing_note:
            application.note = f"{existing_note}\nContact trader: {phone_plain}"
        else:
            application.note = f"\nContact trader: {phone_plain}"

        logger.info(
            "geo_phone_reveal",
            application_id=application.id,
            distance_km=round(distance_km, 3),
            threshold_km=threshold_km,
        )

    # ── Escrow state machine ───────────────────────────────────────────────

    async def worker_done(self, seeker: User, application_id: str) -> GigApplication:
        _require_seeker(seeker)
        app, gig = await self._get_application_and_gig(application_id)
        if app.seeker_id != seeker.id:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your application")
        if app.status != WAITING_FOR_WORKER:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=400, code="INVALID_STATUS", message="Application is not waiting for worker")

        now = datetime.now(timezone.utc)
        app.status = WORKER_DONE
        app.worker_done_at = now
        app.confirmation_deadline_at = now + timedelta(hours=24)

        try:
            from src.workers.job_tasks import check_job_confirmation_deadline
            task = check_job_confirmation_deadline.apply_async(
                args=[app.id],
                countdown=86400,
                queue="default",
            )
            app.celery_deadline_task_id = task.id
        except Exception as e:
            logger.warning("job.deadline_task_failed", application_id=app.id, error=str(e))

        await self._broadcast_job_event(gig.trader_id, "worker_done", app)
        await self.db.flush()
        return app

    async def confirm_application(self, trader: User, application_id: str) -> GigApplication:
        _require_trader(trader)
        app, gig = await self._get_application_and_gig(application_id)
        if gig.trader_id != trader.id:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your gig")
        if app.status != WORKER_DONE:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=400, code="INVALID_STATUS", message="Application must be worker_done to confirm")

        app.status = TRADER_CONFIRMED
        gig.status = GigStatus.COMPLETED
        gig.completed_at = datetime.now(timezone.utc)

        if app.celery_deadline_task_id:
            try:
                from src.workers.celery_app import celery_app
                celery_app.control.revoke(app.celery_deadline_task_id)
            except Exception as e:
                logger.warning("job.deadline_revoke_failed", application_id=app.id, error=str(e))

        await self.db.flush()

        try:
            from src.workers.job_tasks import process_gig_payout
            process_gig_payout.apply_async(args=[gig.id], queue="critical")
        except Exception as e:
            logger.warning("gig.payout_task_failed", gig_id=gig.id, error=str(e))

        try:
            from src.workers.credit_tasks import recalculate_pulse_score
            recalculate_pulse_score.delay(gig.trader_id)
            recalculate_pulse_score.delay(app.seeker_id)
        except Exception as e:
            logger.warning("gig.credit_recalc_dispatch_failed", gig_id=gig.id, error=str(e))

        return app

    async def dispute_application(self, trader: User, application_id: str) -> GigApplication:
        _require_trader(trader)
        app, gig = await self._get_application_and_gig(application_id)
        if gig.trader_id != trader.id:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your gig")
        if app.status != WORKER_DONE:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=400, code="INVALID_STATUS", message="Application must be worker_done to dispute")

        app.status = TRADER_DISPUTED
        await self.db.flush()
        app.status = WAITING_FOR_WORKER
        await self._broadcast_job_event(app.seeker_id, "trader_disputed", app)
        await self.db.flush()
        return app

    async def _get_application_and_gig(self, application_id: str) -> tuple[GigApplication, Gig]:
        q = (
            select(GigApplication, Gig)
            .join(Gig, Gig.id == GigApplication.gig_id)
            .where(GigApplication.id == application_id)
        )
        row = (await self.db.execute(q)).one_or_none()
        if not row:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=404, code="APPLICATION_NOT_FOUND", message="Application not found")
        return row[0], row[1]

    async def _broadcast_job_event(self, user_id: str, event: str, app: GigApplication) -> None:
        logger.info(
            "jobs_realtime_event",
            channel=f"jobs:{user_id}",
            event_type=event,
            application_id=app.id,
            status=app.status,
        )

    # ── Complete ─────────────────────────────────────────────────────────────

    async def complete_gig(self, trader: User, gig_id: str, trader_rating: int | None = None) -> Gig:
        """Trader marks gig complete — queues payout Celery task."""
        _require_trader(trader)
        gig = await self.get_gig(gig_id)
        if gig.trader_id != trader.id:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Not your gig")
        if gig.status != GigStatus.IN_PROGRESS:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=409, code="GIG_NOT_IN_PROGRESS", message="Gig must be in progress to complete")

        gig.status = GigStatus.COMPLETED
        gig.completed_at = datetime.now(timezone.utc)
        if trader_rating is not None:
            gig.trader_rating = max(1, min(5, trader_rating))

        await self.db.flush()

        try:
            from src.workers.job_tasks import process_gig_payout
            process_gig_payout.apply_async(args=[gig.id], queue="critical")
        except Exception as e:
            logger.warning("gig.payout_task_failed", gig_id=gig.id, error=str(e))

        return gig


# ── Role helpers ─────────────────────────────────────────────────────────────

def _require_trader(user: User) -> None:
    if user.user_type not in (UserType.TRADER, UserType.BOTH):
        if (user.role or "").lower() not in ("trader", "both"):
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Trader role required")


def _require_seeker(user: User) -> None:
    if user.user_type not in (UserType.SEEKER, UserType.BOTH):
        if (user.role or "").lower() not in ("job_seeker", "seeker", "both"):
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Job seeker role required")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two GPS points in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))
