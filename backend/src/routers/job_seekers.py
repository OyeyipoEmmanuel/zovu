"""
Job Seekers router — profile, matches, applications, recommendations.
"""
import json
import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, or_

from src.core.database import get_db
from src.dependencies import get_current_user
from src.models import User, Gig, GigApplication, JobRecommendation, GigStatus, Credit
from src.core.utils import format_naira, get_pulse_tier
from src.core.redis_client import get_redis_cache

logger = structlog.get_logger()

router = APIRouter(prefix="/job-seekers", tags=["Job Seekers"])

MATCHES_CACHE_TTL = 600  # 10 minutes


def _serialize_gig_as_job(gig: Gig, match_pct: int = 0, match_tags: list | None = None,
                           email_sent: bool = False) -> dict:
    return {
        "id": gig.id,
        "title": gig.title,
        "description": gig.description,
        "skill_required": gig.skill_required,
        "skills_required": [gig.skill_required] if gig.skill_required else [],
        "location": gig.location,
        "lga": gig.location,
        "employer": "",
        "pay": gig.amount,
        "pay_display": format_naira(gig.amount or 0),
        "pay_period": gig.payment_period or "gig",
        "match_pct": match_pct,
        "match_reasons": match_tags or [],
        "urgent": False,
        "status": gig.status,
        "email_sent": email_sent,
        "posted": gig.created_at.isoformat() if gig.created_at else None,
    }


def _compute_synergy(seeker: User, gig: Gig, credit: Credit | None) -> tuple[int, list[str]]:
    """Simple synergy score: 0-100, returns (score, match_tags)."""
    tags = []
    score = 0
    seeker_skills = seeker.skills_list or []
    if isinstance(seeker_skills, str):
        try:
            seeker_skills = json.loads(seeker_skills)
        except Exception:
            seeker_skills = []

    if gig.skill_required and seeker_skills:
        gig_skill_lower = gig.skill_required.lower()
        matching = [s for s in seeker_skills if gig_skill_lower in s.lower() or s.lower() in gig_skill_lower]
        if matching:
            score += 50
            tags.append(f"Skill match: {matching[0]}")

    if gig.location and seeker.location:
        if gig.location.lower() in seeker.location.lower() or seeker.location.lower() in gig.location.lower():
            score += 30
            tags.append(f"Location: {gig.location}")

    if credit and credit.pulse_score:
        score += min(20, credit.pulse_score // 50)
        if credit.pulse_score >= 400:
            tags.append("Good Pulse Score")

    return min(score, 100), tags


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=dict, summary="Job seeker profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    credit_q = select(Credit).where(Credit.user_id == user.id)
    credit = (await db.execute(credit_q)).scalar_one_or_none()
    score = credit.pulse_score if credit else 0

    return {"ok": True, "data": {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "skills": user.skills_list or [],
        "location": user.location,
        "pulse_score": score,
        "tier": get_pulse_tier(score),
    }}


# ── Matches ───────────────────────────────────────────────────────────────────

@router.get("/matches", response_model=dict, summary="Top skill-matched gigs (cached 10 min)")
async def get_matches(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    redis=Depends(get_redis_cache),
):
    """Return top open gigs sorted by synergy score. Cached 10 minutes per user."""
    _require_seeker(user)
    cache_key = f"matches:{user.id}"

    try:
        cached = await redis.get(cache_key)
        if cached:
            return {"ok": True, "data": json.loads(cached), "cached": True}
    except Exception:
        pass

    credit_q = select(Credit).where(Credit.user_id == user.id)
    credit = (await db.execute(credit_q)).scalar_one_or_none()

    gigs_q = (select(Gig).where(Gig.status == GigStatus.OPEN)
              .order_by(desc(Gig.created_at)).limit(200))
    gigs = (await db.execute(gigs_q)).scalars().all()

    scored = []
    for gig in gigs:
        synergy, tags = _compute_synergy(user, gig, credit)
        if synergy > 0:
            scored.append((synergy, tags, gig))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:limit]

    result = [_serialize_gig_as_job(g, match_pct=s, match_tags=t) for s, t, g in top]

    try:
        await redis.setex(cache_key, MATCHES_CACHE_TTL, json.dumps(result))
    except Exception:
        pass

    return {"ok": True, "data": result}


# ── All gigs ──────────────────────────────────────────────────────────────────

@router.get("/jobs", response_model=dict, summary="Browse all open gigs")
async def list_all_jobs(
    search: str | None = Query(None),
    lga: str | None = Query(None),
    min_pay: int | None = Query(None),
    urgent: bool | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    conditions = [Gig.status == GigStatus.OPEN]
    if search:
        conditions.append(or_(Gig.title.ilike(f"%{search}%"), Gig.skill_required.ilike(f"%{search}%")))
    if lga:
        conditions.append(Gig.location.ilike(f"%{lga}%"))
    if min_pay:
        conditions.append(Gig.amount >= min_pay)

    q = select(Gig).where(and_(*conditions)).order_by(desc(Gig.created_at)).limit(limit)
    gigs = (await db.execute(q)).scalars().all()
    return {"ok": True, "data": [_serialize_gig_as_job(g) for g in gigs]}


# ── Applications ──────────────────────────────────────────────────────────────

@router.get("/applications", response_model=dict, summary="My gig applications")
async def get_my_applications(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    q = select(GigApplication).where(GigApplication.seeker_id == user.id)
    if status:
        q = q.where(GigApplication.status == status)
    q = q.order_by(desc(GigApplication.applied_at))
    apps = (await db.execute(q)).scalars().all()
    return {"ok": True, "data": [
        {
            "id": a.id, "gig_id": a.gig_id, "status": a.status,
            "applied_at": a.applied_at.isoformat() if a.applied_at else None,
        }
        for a in apps
    ]}


# ── Recommendations ───────────────────────────────────────────────────────────

@router.get("/recommendations", response_model=dict, summary="AI-matched recommendations")
async def get_recommendations(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return stored JobRecommendation rows for the seeker (newest unviewed first)."""
    _require_seeker(user)

    q = (
        select(JobRecommendation, Gig)
        .join(Gig, Gig.id == JobRecommendation.gig_id)
        .where(JobRecommendation.seeker_id == user.id)
        .order_by(JobRecommendation.viewed.asc(), desc(JobRecommendation.synergy_score))
        .limit(limit)
    )
    rows = (await db.execute(q)).all()

    result = []
    for rec, gig in rows:
        item = _serialize_gig_as_job(
            gig,
            match_pct=int(rec.synergy_score),
            match_tags=rec.match_tags or [],
            email_sent=rec.email_sent,
        )
        item["recommendation_id"] = rec.id
        item["viewed"] = rec.viewed
        item["applied"] = rec.applied
        result.append(item)

    unviewed_ids = [r.id for r, _ in rows if not r.viewed]
    if unviewed_ids:
        from sqlalchemy import update
        await db.execute(
            update(JobRecommendation)
            .where(JobRecommendation.id.in_(unviewed_ids))
            .values(viewed=True)
        )
        await db.commit()

    return {"ok": True, "data": result}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=dict, summary="Job seeker dashboard summary")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    credit_q = select(Credit).where(Credit.user_id == user.id)
    credit = (await db.execute(credit_q)).scalar_one_or_none()
    score = credit.pulse_score if credit else 0

    apps_q = select(GigApplication).where(GigApplication.seeker_id == user.id)
    apps = (await db.execute(apps_q)).scalars().all()

    recs_q = select(JobRecommendation).where(
        and_(JobRecommendation.seeker_id == user.id, JobRecommendation.viewed == False)
    )
    unread_recs = len((await db.execute(recs_q)).scalars().all())

    return {"ok": True, "data": {
        "pulse_score": score,
        "tier": get_pulse_tier(score),
        "applications": len(apps),
        "active_applications": sum(1 for a in apps if a.status == "pending"),
        "unread_recommendations": unread_recs,
    }}


# ── Role helper ───────────────────────────────────────────────────────────────

def _require_seeker(user: User) -> None:
    if (user.role or "").lower() not in ("job_seeker", "seeker", "both"):
        from src.core.exceptions import ZovuAPIError
        raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Job seeker role required")
