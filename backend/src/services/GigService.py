"""
GigService — business logic for gig lifecycle.
"""
import uuid
import structlog
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, or_

from src.models.base import Gig, GigApplication, GigStatus, User, UserType

logger = structlog.get_logger()


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
        """Seeker applies to a gig. One application per seeker per gig."""
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

    async def accept_applicant(self, trader: User, gig_id: str, application_id: str) -> Gig:
        """Trader accepts an applicant — gig moves to IN_PROGRESS."""
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

        app.status = "accepted"
        gig.seeker_id = app.seeker_id
        gig.status = GigStatus.IN_PROGRESS
        gig.accepted_at = datetime.now(timezone.utc)

        reject_q = select(GigApplication).where(
            and_(GigApplication.gig_id == gig_id, GigApplication.id != application_id)
        )
        others = (await self.db.execute(reject_q)).scalars().all()
        for other in others:
            other.status = "rejected"

        await self.db.flush()
        return gig

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
