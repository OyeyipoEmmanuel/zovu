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
from src.models import User, Gig, GigApplication, JobRecommendation, GigStatus
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


_GIG_TOKEN_STOPWORDS = {
    "a", "an", "the", "of", "for", "and", "or", "to", "in", "on", "with",
    "job", "work", "service", "services", "needed", "wanted",
}


def _tokenize(text: str) -> set[str]:
    """Lowercase + alpha-only token bag, minus common filler words."""
    import re
    tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    return {t for t in tokens if len(t) > 2 and t not in _GIG_TOKEN_STOPWORDS}


def _compute_synergy(seeker: User, gig: Gig) -> tuple[int, list[str]]:
    """
    Multi-signal synergy score (0-100), returns (score, match_tags).

    Weights (sum to 100):
      • Skill overlap            45  — Jaccard-style token overlap on gig.skill_required
                                       and the gig description vs. the seeker's skills_list
      • Location proximity       20  — substring match on LGA / location string
      • Pulse score              15  — proportional to (pulse / 850)
      • Completion rate          10  — proportional to seeker.completion_rate (0-1)
      • Punctuality              5   — proportional to seeker.punctuality_index (0-1)
      • Language overlap         5   — gig.payment_period sometimes carries language tag
                                       elsewhere; otherwise reward speakers of major NG languages
    """
    tags: list[str] = []
    score = 0.0

    # Normalize seeker skills (JSON column may arrive as str)
    seeker_skills = seeker.skills_list or []
    if isinstance(seeker_skills, str):
        try:
            seeker_skills = json.loads(seeker_skills)
        except Exception:
            seeker_skills = []
    seeker_tokens: set[str] = set()
    for s in seeker_skills:
        seeker_tokens |= _tokenize(str(s))

    # 1. Skill overlap (45 pts)
    gig_tokens = _tokenize(f"{gig.skill_required or ''} {gig.title or ''} {gig.description or ''}")
    if seeker_tokens and gig_tokens:
        overlap = seeker_tokens & gig_tokens
        union = seeker_tokens | gig_tokens
        jaccard = len(overlap) / len(union) if union else 0.0
        coverage = len(overlap) / len(gig_tokens) if gig_tokens else 0.0
        skill_pts = 45.0 * (0.4 * jaccard + 0.6 * coverage)
        score += skill_pts
        if overlap:
            shown = sorted(overlap)[:3]
            tags.append("Skill match: " + ", ".join(shown))

    # 2. Location proximity (20 pts)
    if gig.location and seeker.location:
        g = gig.location.lower().strip()
        s = seeker.location.lower().strip()
        if g and s and (g == s):
            score += 20.0
            tags.append(f"Same LGA: {gig.location}")
        elif g in s or s in g:
            score += 14.0
            tags.append(f"Nearby LGA: {gig.location}")

    # 3. Pulse score (15 pts)
    pulse = int(seeker.pulse_score or 0)
    if pulse > 0:
        pulse_pts = 15.0 * min(1.0, pulse / 850.0)
        score += pulse_pts
        if pulse >= 700:
            tags.append("Gold Pulse")
        elif pulse >= 400:
            tags.append("Silver Pulse")

    # 4. Completion rate (10 pts) — only counts if seeker has history
    completion = float(seeker.completion_rate or 0.0)
    if completion > 0:
        score += 10.0 * min(1.0, completion)
        if completion >= 0.9:
            tags.append("High completion rate")

    # 5. Punctuality (5 pts)
    punctuality = float(seeker.punctuality_index or 0.0)
    if punctuality > 0:
        score += 5.0 * min(1.0, punctuality)

    # 6. Language signal (5 pts) — fixed bonus for documented languages
    languages = seeker.languages_spoken or []
    if isinstance(languages, str):
        try:
            languages = json.loads(languages)
        except Exception:
            languages = []
    if languages:
        score += 5.0

    final = max(0, min(100, int(round(score))))
    return final, tags


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=dict, summary="Job seeker profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    score = int(user.pulse_score or 0)

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

    gigs_q = (select(Gig).where(Gig.status == GigStatus.OPEN)
              .order_by(desc(Gig.created_at)).limit(200))
    gigs = (await db.execute(gigs_q)).scalars().all()

    scored = []
    for gig in gigs:
        synergy, tags = _compute_synergy(user, gig)
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
    score = int(user.pulse_score or 0)

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


# ── Notifications ─────────────────────────────────────────────────────────────


def _job_recommendation_to_notification(rec: JobRecommendation, gig: Gig | None) -> dict:
    title = "New job match"
    body = "A new gig matches your skills."
    if gig:
        title = f"New match: {gig.title or gig.skill_required or 'Gig'}"
        if gig.location:
            body = f"{gig.skill_required or 'Gig'} in {gig.location}"
    return {
        "id": rec.id,
        "type": "job",
        "title": title,
        "body": body,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "read": bool(rec.viewed),
    }


@router.get("/notifications", response_model=dict, summary="Notifications feed")
async def list_notifications(
    type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Notifications surface to the seeker: job recommendations + payment events + score events.
    Currently job recommendations are real DB rows; payment/score events are derived
    from completed gig applications and recent Transactions.
    """
    _require_seeker(user)

    items: list[dict] = []

    if type in (None, "job"):
        recs_q = (
            select(JobRecommendation, Gig)
            .join(Gig, Gig.id == JobRecommendation.gig_id, isouter=True)
            .where(JobRecommendation.seeker_id == user.id)
            .order_by(desc(JobRecommendation.created_at))
            .limit(limit)
        )
        for rec, gig in (await db.execute(recs_q)).all():
            items.append(_job_recommendation_to_notification(rec, gig))

    if type in (None, "payment"):
        from src.models import Transaction
        tx_q = (
            select(Transaction)
            .where(Transaction.receiver_id == user.id, Transaction.status == "completed")
            .order_by(desc(Transaction.created_at))
            .limit(limit)
        )
        for tx in (await db.execute(tx_q)).scalars().all():
            items.append({
                "id": f"tx_{tx.id}",
                "type": "payment",
                "title": "Payment received",
                "body": f"₦{(tx.amount or 0) / 100:,.2f} credited to your wallet.",
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
                "read": True,
            })

    if type in (None, "score"):
        if user.pulse_score:
            items.append({
                "id": f"score_{user.id}",
                "type": "score",
                "title": "Pulse Score updated",
                "body": f"Your Pulse Score is now {user.pulse_score}.",
                "created_at": user.updated_at.isoformat() if user.updated_at else None,
                "read": True,
            })

    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"ok": True, "data": items[:limit]}


@router.post("/mark-notifications-read", response_model=dict, summary="Mark all notifications as read")
async def mark_notifications_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark all unviewed job recommendations as viewed."""
    _require_seeker(user)
    from sqlalchemy import update
    await db.execute(
        update(JobRecommendation)
        .where(JobRecommendation.seeker_id == user.id, JobRecommendation.viewed == False)
        .values(viewed=True)
    )
    await db.commit()
    return {"ok": True, "data": {"success": True}}


# ── QR check-in ───────────────────────────────────────────────────────────────


@router.get("/qr", response_model=dict, summary="QR check-in payload for seeker")
async def get_qr_payload(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    return {"ok": True, "data": {
        "customer_identifier": user.id,
        "zovu_id": user.id,
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.full_name or user.email,
        "skills": user.skills_list or [],
    }}


# ── Onboarding ────────────────────────────────────────────────────────────────


from pydantic import BaseModel
from typing import Literal


class OnboardingSkillsRequest(BaseModel):
    skills: list[str]
    languages: list[str]
    primary_language: str | None = None


class WorkHistoryItem(BaseModel):
    job_title: str
    employer: str | None = None
    type: Literal["full_time", "part_time", "gig", "apprenticeship"]
    duration: str


class OnboardingExperienceRequest(BaseModel):
    years_of_experience: str
    education_level: str
    currently_employed: bool
    current_job_title: str | None = None
    current_employer: str | None = None
    work_history: list[WorkHistoryItem] = []


class OnboardingPreferencesRequest(BaseModel):
    availability: Literal["full_time", "part_time", "gig", "open"]
    preferred_lgas: list[str]
    willing_to_relocate: bool
    min_pay: int
    pay_period: Literal["hour", "day", "week", "month", "gig"]
    auto_save_pct: float
    emergency_contact_name: str
    emergency_contact_phone: str


@router.post("/onboarding/skills", response_model=dict)
async def onboarding_skills(
    payload: OnboardingSkillsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    # `user` is detached from the live session (see notes in auth.submit_kyc).
    # Without merge, attribute writes are no-ops at commit time.
    user = await db.merge(user)
    user.skills_list = payload.skills
    user.languages_spoken = payload.languages
    user.primary_language = payload.primary_language or (payload.languages[0] if payload.languages else None)
    await db.commit()
    return {"ok": True, "data": {"success": True}}


@router.post("/onboarding/experience", response_model=dict)
async def onboarding_experience(
    payload: OnboardingExperienceRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    user = await db.merge(user)
    # Persist into bio as JSON; no dedicated table yet.
    import json as _json
    user.bio = _json.dumps(payload.model_dump())
    await db.commit()
    return {"ok": True, "data": {"success": True}}


@router.post("/onboarding/preferences", response_model=dict)
async def onboarding_preferences(
    payload: OnboardingPreferencesRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    user = await db.merge(user)
    user.auto_save_pct = max(0.0, min(1.0, float(payload.auto_save_pct or 0.0) / 100.0 if payload.auto_save_pct > 1 else float(payload.auto_save_pct)))
    user.profile_complete = True
    await db.commit()
    return {"ok": True, "data": {"success": True}}


@router.get("/onboarding/status", response_model=dict)
async def onboarding_status(
    user: User = Depends(get_current_user),
):
    _require_seeker(user)
    if user.profile_complete:
        step = "done"
    elif user.bio:
        step = "preferences"
    elif user.skills_list:
        step = "experience"
    else:
        step = "skills"
    return {"ok": True, "data": {"complete": bool(user.profile_complete), "current_step": step}}


# ── Role helper ───────────────────────────────────────────────────────────────

def _require_seeker(user: User) -> None:
    if (user.role or "").lower() not in ("job_seeker", "seeker", "both"):
        from src.core.exceptions import ZovuAPIError
        raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Job seeker role required")
