"""
Reviews router — bi-directional ratings between traders and job seekers.

Visibility rules:
- Anyone (auth or not) can GET reviews for a user. The site lists them publicly
  on profile pages, gig listings (trader rating), and applicant cards
  (seeker rating shown to traders after the seeker has applied).
- Only authenticated parties to a completed gig can POST a review. Each side
  can review the other once per gig (enforced by uq_review_per_gig).

The router intentionally stays thin — the heavy lifting (auth, gig lookups)
goes through existing helpers so the same conventions apply.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from src.core.database import get_db
from src.core.exceptions import ZovuAPIError
from src.dependencies import get_current_user
from src.models import User, Review, Gig, GigApplication, GigStatus
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/reviews", tags=["Reviews"])


class CreateReviewRequest(BaseModel):
    reviewee_id: str
    gig_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


def _serialize_review(r: Review, reviewer: User | None = None) -> dict:
    name = None
    if reviewer is not None:
        name = (
            (reviewer.full_name or "").strip()
            or f"{(reviewer.first_name or '').strip()} {(reviewer.last_name or '').strip()}".strip()
            or reviewer.business_name
            or reviewer.company_name
            or reviewer.email
        )
    return {
        "id": r.id,
        "reviewer_id": r.reviewer_id,
        "reviewer_name": name,
        "reviewer_role": r.reviewer_role,
        "reviewee_id": r.reviewee_id,
        "gig_id": r.gig_id,
        "rating": r.rating,
        "comment": r.comment,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


async def _aggregate_for(db: AsyncSession, user_id: str) -> dict:
    q = select(func.count(Review.id), func.avg(Review.rating)).where(Review.reviewee_id == user_id)
    row = (await db.execute(q)).first()
    count = int(row[0] or 0)
    avg = float(row[1]) if row[1] is not None else 0.0
    return {"user_id": user_id, "review_count": count, "average_rating": round(avg, 2)}


@router.post("", summary="Leave a review for the other party in a completed gig")
async def create_review(
    payload: CreateReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a review. Only allowed once both sides participated in the gig
    and the gig has reached IN_PROGRESS or COMPLETED.

    The reviewer's role (trader vs seeker) is derived from their relationship
    to the gig — not user-supplied — so the value can be trusted downstream.
    """
    if payload.reviewee_id == user.id:
        raise ZovuAPIError(status_code=400, code="SELF_REVIEW", message="You cannot review yourself.")

    gig = await db.get(Gig, payload.gig_id)
    if not gig:
        raise ZovuAPIError(status_code=404, code="GIG_NOT_FOUND", message="Gig not found.")

    is_trader = gig.trader_id == user.id
    is_seeker = gig.seeker_id == user.id
    if not (is_trader or is_seeker):
        raise ZovuAPIError(status_code=403, code="NOT_A_PARTICIPANT", message="You did not participate in this gig.")

    # The other side of the gig is the only valid reviewee for this gig.
    expected_reviewee = gig.seeker_id if is_trader else gig.trader_id
    if expected_reviewee != payload.reviewee_id:
        raise ZovuAPIError(
            status_code=400,
            code="INVALID_REVIEWEE",
            message="You can only review the other participant in this gig.",
        )

    if gig.status not in (GigStatus.IN_PROGRESS, GigStatus.COMPLETED):
        raise ZovuAPIError(
            status_code=409,
            code="GIG_NOT_REVIEWABLE",
            message="Reviews are available after the gig has started.",
        )

    # Prevent duplicates explicitly so we can return a clean error rather than
    # leaning on the unique-index 500.
    existing = (await db.execute(
        select(Review).where(
            Review.reviewer_id == user.id,
            Review.reviewee_id == payload.reviewee_id,
            Review.gig_id == payload.gig_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise ZovuAPIError(
            status_code=409,
            code="ALREADY_REVIEWED",
            message="You have already reviewed this user for this gig.",
        )

    review = Review(
        reviewer_id=user.id,
        reviewee_id=payload.reviewee_id,
        gig_id=payload.gig_id,
        rating=payload.rating,
        comment=(payload.comment or "").strip() or None,
        reviewer_role="trader" if is_trader else "seeker",
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    logger.info(
        "review.created",
        reviewer_id=user.id,
        reviewee_id=payload.reviewee_id,
        gig_id=payload.gig_id,
        rating=payload.rating,
    )

    return {"ok": True, "data": _serialize_review(review, reviewer=user)}


@router.get("/users/{user_id}", summary="List reviews left FOR a user (public)")
async def list_user_reviews(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent reviews left for `user_id` plus an aggregate.

    Public — used on profile pages, applicant cards, and job listings.
    """
    target = await db.get(User, user_id)
    if not target:
        raise ZovuAPIError(status_code=404, code="USER_NOT_FOUND", message="User not found.")

    q = (
        select(Review, User)
        .join(User, User.id == Review.reviewer_id)
        .where(Review.reviewee_id == user_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    aggregate = await _aggregate_for(db, user_id)
    return {
        "ok": True,
        "data": {
            **aggregate,
            "reviews": [_serialize_review(r, reviewer=u) for r, u in rows],
        },
    }


@router.get("/users/{user_id}/aggregate", summary="Just the aggregate rating for a user (public)")
async def user_rating_aggregate(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lighter version for hover cards / list views that only need count + average."""
    return {"ok": True, "data": await _aggregate_for(db, user_id)}


@router.get("/gigs/{gig_id}", summary="Reviews tied to a specific gig (public)")
async def list_gig_reviews(
    gig_id: str,
    db: AsyncSession = Depends(get_db),
):
    gig = await db.get(Gig, gig_id)
    if not gig:
        raise ZovuAPIError(status_code=404, code="GIG_NOT_FOUND", message="Gig not found.")

    q = (
        select(Review, User)
        .join(User, User.id == Review.reviewer_id)
        .where(Review.gig_id == gig_id)
        .order_by(Review.created_at.desc())
    )
    rows = (await db.execute(q)).all()
    return {"ok": True, "data": [_serialize_review(r, reviewer=u) for r, u in rows]}


@router.get("/can-review", summary="Can the authed user review the other party on this gig?")
async def can_review(
    gig_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Used by the UI to decide whether to render the review prompt."""
    gig = await db.get(Gig, gig_id)
    if not gig:
        return {"ok": True, "data": {"allowed": False, "reason": "GIG_NOT_FOUND"}}

    is_trader = gig.trader_id == user.id
    is_seeker = gig.seeker_id == user.id
    if not (is_trader or is_seeker):
        return {"ok": True, "data": {"allowed": False, "reason": "NOT_A_PARTICIPANT"}}
    if gig.status not in (GigStatus.IN_PROGRESS, GigStatus.COMPLETED):
        return {"ok": True, "data": {"allowed": False, "reason": "GIG_NOT_REVIEWABLE"}}

    reviewee_id = gig.seeker_id if is_trader else gig.trader_id
    if not reviewee_id:
        return {"ok": True, "data": {"allowed": False, "reason": "NO_COUNTERPART"}}

    existing = (await db.execute(
        select(Review).where(
            Review.reviewer_id == user.id,
            Review.gig_id == gig_id,
        )
    )).scalar_one_or_none()
    if existing:
        return {"ok": True, "data": {"allowed": False, "reason": "ALREADY_REVIEWED"}}

    return {"ok": True, "data": {"allowed": True, "reviewee_id": reviewee_id, "role": "trader" if is_trader else "seeker"}}
