"""Application escrow state-machine routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.dependencies import get_current_user
from src.models import User
from src.services.GigService import GigService

router = APIRouter(tags=["Applications"])


def _serialize_application(app) -> dict:
    return {
        "id": app.id,
        "gig_id": app.gig_id,
        "seeker_id": app.seeker_id,
        "status": app.status,
        "reserved_amount": app.reserved_amount,
        "worker_done_at": app.worker_done_at.isoformat() if app.worker_done_at else None,
        "confirmation_deadline_at": app.confirmation_deadline_at.isoformat() if app.confirmation_deadline_at else None,
        "note": app.note,
        "applied_at": app.applied_at.isoformat() if app.applied_at else None,
    }


@router.post("/listings/{gig_id}/apply", response_model=dict, summary="Apply to listing")
async def apply_to_listing(
    gig_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = GigService(db)
    async with db.begin_nested():
        app = await svc.apply_to_gig(user, gig_id)
    await db.commit()
    return {"ok": True, "data": _serialize_application(app)}


@router.patch("/applications/{application_id}/worker-done", response_model=dict, summary="Worker marks job done")
async def mark_worker_done(
    application_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = GigService(db)
    async with db.begin_nested():
        app = await svc.worker_done(user, application_id)
    await db.commit()
    return {"ok": True, "data": _serialize_application(app)}


@router.patch("/applications/{application_id}/confirm", response_model=dict, summary="Trader confirms completed job")
async def confirm_application(
    application_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = GigService(db)
    async with db.begin_nested():
        app = await svc.confirm_application(user, application_id)
    await db.commit()
    return {"ok": True, "data": _serialize_application(app)}


@router.patch("/applications/{application_id}/dispute", response_model=dict, summary="Trader marks job incomplete")
async def dispute_application(
    application_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = GigService(db)
    async with db.begin_nested():
        app = await svc.dispute_application(user, application_id)
    await db.commit()
    return {"ok": True, "data": _serialize_application(app)}
