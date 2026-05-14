"""
Gigs router — CRUD, apply, accept, complete endpoints.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.core.database import get_db
from src.dependencies import get_current_user
from src.models import User
from src.services.GigService import GigService
from src.core.utils import format_naira
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/gigs", tags=["Gigs"])


def _serialize_gig(gig) -> dict:
    return {
        "id": gig.id,
        "trader_id": gig.trader_id,
        "seeker_id": gig.seeker_id,
        "title": gig.title,
        "description": gig.description,
        "skill_required": gig.skill_required,
        "payment_period": gig.payment_period,
        "location": gig.location,
        "amount": gig.amount,
        "amount_display": format_naira(gig.amount or 0),
        "status": gig.status,
        "trader_rating": gig.trader_rating,
        "seeker_rating": gig.seeker_rating,
        "created_at": gig.created_at.isoformat() if gig.created_at else None,
        "accepted_at": gig.accepted_at.isoformat() if gig.accepted_at else None,
        "completed_at": gig.completed_at.isoformat() if gig.completed_at else None,
        "cancelled_at": gig.cancelled_at.isoformat() if gig.cancelled_at else None,
    }


def _serialize_application(app) -> dict:
    return {
        "id": app.id,
        "gig_id": app.gig_id,
        "seeker_id": app.seeker_id,
        "status": app.status,
        "applied_at": app.applied_at.isoformat() if app.applied_at else None,
    }


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateGigRequest(BaseModel):
    title: str
    description: str | None = None
    skill_required: str
    location: str
    amount: int
    payment_period: str | None = None


class CompleteGigRequest(BaseModel):
    trader_rating: int | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("", response_model=dict, summary="Create gig (trader)")
async def create_gig(
    payload: CreateGigRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new open gig. Trader role required."""
    svc = GigService(db)
    async with db.begin_nested():
        gig = await svc.create_gig(user, payload.model_dump())
    await db.commit()
    return {"ok": True, "data": _serialize_gig(gig)}


@router.get("", response_model=dict, summary="List open gigs (public)")
async def list_gigs(
    skill: str | None = Query(None),
    location: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List OPEN gigs with optional skill/location filters (no auth required)."""
    svc = GigService(db)
    gigs = await svc.list_open_gigs(limit=limit, cursor_id=cursor, skill=skill, location=location)
    return {"ok": True, "data": [_serialize_gig(g) for g in gigs]}


@router.get("/my-gigs", response_model=dict, summary="List trader's own gigs")
async def list_my_gigs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trader's own gigs across all statuses."""
    svc = GigService(db)
    gigs = await svc.list_my_gigs(user)
    return {"ok": True, "data": [_serialize_gig(g) for g in gigs]}


@router.get("/{gig_id}", response_model=dict, summary="Get gig by ID")
async def get_gig(
    gig_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single gig by ID (no auth required)."""
    svc = GigService(db)
    gig = await svc.get_gig(gig_id)
    return {"ok": True, "data": _serialize_gig(gig)}


@router.post("/{gig_id}/apply", response_model=dict, summary="Apply to gig (seeker)")
async def apply_to_gig(
    gig_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Job seeker applies to a gig. One application per seeker per gig."""
    svc = GigService(db)
    async with db.begin_nested():
        app = await svc.apply_to_gig(user, gig_id)
    await db.commit()
    return {"ok": True, "data": _serialize_application(app)}


@router.get("/{gig_id}/applicants", response_model=dict, summary="List applicants (trader)")
async def list_applicants(
    gig_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trader lists all applicants for their gig."""
    svc = GigService(db)
    apps = await svc.list_applicants(user, gig_id)
    return {"ok": True, "data": [_serialize_application(a) for a in apps]}


@router.post("/{gig_id}/accept/{application_id}", response_model=dict, summary="Accept applicant (trader)")
async def accept_applicant(
    gig_id: str,
    application_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trader accepts a seeker applicant — gig moves to IN_PROGRESS."""
    svc = GigService(db)
    async with db.begin_nested():
        gig = await svc.accept_applicant(user, gig_id, application_id)
    await db.commit()
    return {"ok": True, "data": _serialize_gig(gig)}


@router.post("/{gig_id}/complete", response_model=dict, summary="Complete gig (trader)")
async def complete_gig(
    gig_id: str,
    payload: CompleteGigRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trader marks gig complete, queues payout task."""
    svc = GigService(db)
    async with db.begin_nested():
        gig = await svc.complete_gig(user, gig_id, payload.trader_rating)
    await db.commit()
    return {"ok": True, "data": _serialize_gig(gig)}
