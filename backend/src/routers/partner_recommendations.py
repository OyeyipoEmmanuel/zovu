"""
Partner recommendations router — returns partner financial products
(loans, insurance, savings) tailored to a user's Pulse Score tier.

NOTE: This is intentionally separate from the existing job
`GET /api/v1/job-seekers/recommendations` route — that one returns *jobs*
to seekers; this one returns *partner products* to both seekers and traders.
"""
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, desc
# pyrefly: ignore [missing-import]
from redis.asyncio import Redis
# pyrefly: ignore [missing-import]
import json
# pyrefly: ignore [missing-import]
import structlog

from src.core.database import get_db
from src.core.redis_client import get_redis_cache
from src.core.utils import get_pulse_tier
from src.config import settings
from src.dependencies import get_current_user
from src.models import User, LenderServiceOffering

logger = structlog.get_logger()

router = APIRouter(prefix="/partner-recommendations", tags=["Partner Recommendations"])

# Cache TTL for recommendations responses (1 hour).
RECS_CACHE_TTL_SECONDS = 3600
RECS_CACHE_PREFIX = "recs"
MAX_RECOMMENDATIONS = 3


def _cta_label_for(offering_type: str) -> str:
    """Map offering.type → CTA button text."""
    t = (offering_type or "").strip().lower()
    if t == "loan":
        return "Apply Now"
    if t == "insurance":
        return "Get Insured"
    if t == "savings":
        return "Start Saving"
    return "Learn More"


def _cta_url_for(offering_id: str) -> str:
    """Deep-link to the partner's product page on the ZOVU frontend.

    The partners side has a `/dashboard/partners/services` listing — we
    target `/dashboard/partners/services/<offering_id>` so the click can
    land on a specific product. If FRONTEND_URL is somehow blank, fall
    back to '#' so the UI still renders the button.
    """
    base = (settings.FRONTEND_URL or "").rstrip("/")
    if not base or not offering_id:
        return "#"
    return f"{base}/dashboard/partners/services/{offering_id}"


def _serialize_offering(
    offering: LenderServiceOffering,
    partner_name: str | None,
) -> dict:
    return {
        "id": offering.id,
        "product_name": offering.name,
        "partner_name": partner_name or "ZOVU Partner",
        "type": offering.type,
        "description": offering.description or "",
        "cta_label": _cta_label_for(offering.type),
        "cta_url": _cta_url_for(offering.id),
        "min_score_required": int(offering.min_pulse_score or 0),
    }


@router.get(
    "/{user_id}",
    response_model=dict,
    summary="Partner product recommendations",
    description=(
        "Returns up to 3 partner financial products (loans, insurance, "
        "savings) the user is currently eligible for, based on their "
        "Pulse Score tier. Cached in Redis under `recs:{userId}` for "
        "1 hour. Users can only fetch their own recommendations."
    ),
)
async def get_partner_recommendations(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
):
    """
    Build a list of partner products the user is eligible for.

    Eligibility rule (spec):
      - `LenderServiceOffering.status == 'active'`
      - `LenderServiceOffering.min_pulse_score <= user.pulse_score`
      - Max 3, sorted by `min_pulse_score DESC` (most exclusive first)
    """
    # Authorisation: a user can only see their own recommendations.
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    cache_key = f"{RECS_CACHE_PREFIX}:{current_user.id}"

    # Try the cache first — recs are stable enough to serve from Redis.
    try:
        cached = await redis.get(cache_key)
        if cached:
            payload = json.loads(cached.decode() if isinstance(cached, bytes) else cached)
            return payload
    except Exception as exc:
        logger.warning("partner_recs_cache_get_failed", error=str(exc))

    score = int(current_user.pulse_score or 0)
    tier = get_pulse_tier(score)

    # Fetch eligible active offerings, ordered most-exclusive first.
    stmt = (
        select(LenderServiceOffering)
        .where(
            LenderServiceOffering.status == "active",
            LenderServiceOffering.min_pulse_score <= score,
        )
        .order_by(desc(LenderServiceOffering.min_pulse_score))
        .limit(MAX_RECOMMENDATIONS)
    )
    offerings = (await db.execute(stmt)).scalars().all()

    # Bulk-fetch the partner/lender display names in one query.
    partner_map: dict[str, str] = {}
    lender_ids = list({o.lender_id for o in offerings if o.lender_id})
    if lender_ids:
        lender_rows = (
            await db.execute(select(User).where(User.id.in_(lender_ids)))
        ).scalars().all()
        for u in lender_rows:
            display = (
                (u.company_name or "").strip()
                or (u.business_name or "").strip()
                or (u.full_name or "").strip()
                or u.email
            )
            partner_map[u.id] = display

    recommendations = [
        _serialize_offering(o, partner_map.get(o.lender_id)) for o in offerings
    ]

    payload = {
        "recommendations": recommendations,
        "user_id": current_user.id,
        "pulse_score": score,
        "tier": tier,
    }

    # Cache for 1 hour. Best-effort — if Redis is down we still serve the response.
    try:
        await redis.setex(cache_key, RECS_CACHE_TTL_SECONDS, json.dumps(payload))
    except Exception as exc:
        logger.warning("partner_recs_cache_set_failed", error=str(exc))

    return payload
