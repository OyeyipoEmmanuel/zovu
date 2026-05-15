"""
Admin dashboard router.
All endpoints require admin role. Returns ZOVU standard envelope format.
"""
from fastapi import APIRouter, Depends, Query, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from redis import Redis
from uuid import UUID
from datetime import date, timezone
import structlog

from src.dependencies import get_db, get_redis_cache_dep, require_admin, get_current_user
from src.models.base import User
from src.services.complaint_service import ComplaintService
from src.services.fraud_service import FraudService
from src.services.metrics_service import MetricsService
from src.services.partnership_service import PartnershipService
from src.core.exceptions import ZovuAPIError
from src.models import Ajo, AjoMembership, AjoStatus, AjoTransaction
from sqlalchemy import select, func
from datetime import datetime
from pydantic import BaseModel
from src.config import settings

logger = structlog.get_logger()

router = APIRouter()


# ── COMPLAINTS ──────────────────────────────────────────────


@router.get("/complaints")
async def list_complaints(
    status: str | None = Query(None),
    urgency: str | None = Query(None),
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List complaints with filtering and cursor pagination."""
    service = ComplaintService(db)
    data = await service.list_complaints(
        status=status,
        urgency=urgency,
        category=category,
        limit=limit,
        cursor=cursor,
    )
    return {"ok": True, "data": data}


@router.get("/complaints/{complaint_id}")
async def get_complaint(
    complaint_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get complaint details."""
    service = ComplaintService(db)
    data = await service.get_complaint(complaint_id)
    return {"ok": True, "data": data}


@router.post("/complaints")
async def create_complaint(
    transaction_id: UUID = Body(...),
    category: str = Body(...),
    description: str = Body(...),
    urgency: str = Body("medium"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    User files a complaint about their own transaction.
    No admin required — authenticated users only.
    """
    service = ComplaintService(db)
    data = await service.create_complaint(
        complainant_id=user.id,
        transaction_id=transaction_id,
        category=category,
        description=description,
        urgency=urgency,
    )
    await db.commit()
    return {"ok": True, "data": data}


@router.get("/complaints/mine")
async def list_my_complaints(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Authenticated user lists complaints they have filed."""
    from src.models.admin import Complaint
    q = (
        select(Complaint)
        .where(Complaint.complainant_id == user.id)
        .order_by(Complaint.created_at.desc())
    )
    rows = (await db.execute(q)).scalars().all()
    return {"ok": True, "data": [
        {
            "id": c.id,
            "transaction_id": c.transaction_id,
            "category": c.category,
            "description": c.description,
            "status": c.status,
            "urgency": c.urgency,
            "resolution": c.resolution,
            "admin_notes": c.admin_notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        }
        for c in rows
    ]}


@router.post("/complaints/{complaint_id}/verify-squad")
async def verify_complaint_with_squad(
    complaint_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verify complaint with Squad API."""
    service = ComplaintService(db)
    data = await service.verify_with_squad(complaint_id, admin.id)
    return {"ok": True, "data": data}


@router.patch("/complaints/{complaint_id}")
async def update_complaint(
    complaint_id: UUID,
    status: str | None = Body(None),
    resolution: str | None = Body(None),
    admin_notes: str | None = Body(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update complaint status, resolution, and notes."""
    service = ComplaintService(db)
    data = await service.update_complaint(
        complaint_id=complaint_id,
        status=status,
        resolution=resolution,
        admin_notes=admin_notes,
        admin_id=admin.id,
    )
    return {"ok": True, "data": data}


@router.get("/complaints/stats")
async def get_complaint_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get complaint statistics."""
    service = ComplaintService(db)
    data = await service.get_complaint_stats()
    return {"ok": True, "data": data}


# ── FRAUD MANAGEMENT ────────────────────────────────────────


@router.get("/users/flagged")
async def list_flagged_users(
    reason: str | None = Query(None),
    min_score: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List flagged users."""
    service = FraudService(db)
    data = await service.get_flagged_users(
        reason=reason,
        min_score=min_score,
        status=status,
        limit=limit,
        cursor=cursor,
    )
    return {"ok": True, "data": data}


@router.post("/users/{user_id}/flag")
async def flag_user(
    user_id: UUID,
    reason: str = Body(...),
    notes: str = Body(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Flag a user for fraud review."""
    service = FraudService(db)
    data = await service.flag_user(
        user_id=user_id,
        reason=reason,
        notes=notes,
        flagged_by=admin.email,
        admin_id=admin.id,
    )
    return {"ok": True, "data": data}


@router.post("/users/{user_id}/pause")
async def pause_user_account(
    user_id: UUID,
    reason: str = Body(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Pause a user account."""
    service = FraudService(db)
    data = await service.pause_account(
        user_id=user_id,
        reason=reason,
        admin_id=admin.id,
    )
    await db.commit()
    return {"ok": True, "data": data}


@router.post("/users/{user_id}/unpause")
async def unpause_user_account(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Unpause a user account."""
    service = FraudService(db)
    data = await service.unpause_account(
        user_id=user_id,
        admin_id=admin.id,
    )
    await db.commit()
    return {"ok": True, "data": data}


@router.delete("/users/{user_id}")
async def delete_user_account(
    user_id: UUID,
    reason: str = Body(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Permanently delete a user account."""
    service = FraudService(db)
    data = await service.delete_account(
        user_id=user_id,
        reason=reason,
        admin_id=admin.id,
    )
    await db.commit()
    return data  # Already has ok: true format


@router.get("/fraud/analytics")
async def get_fraud_analytics(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get fraud analytics."""
    service = FraudService(db)
    data = await service.get_fraud_analytics(days=days)
    return {"ok": True, "data": data}


# ── METRICS ─────────────────────────────────────────────────


@router.get("/metrics/overview")
async def get_metrics_overview(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get admin dashboard overview metrics."""
    service = MetricsService(db)
    data = await service.get_overview()
    return {"ok": True, "data": data}


@router.get("/metrics/users")
async def get_user_metrics(
    period_days: int = Query(30, ge=1, le=365),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get user growth metrics."""
    service = MetricsService(db)
    data = await service.get_user_metrics(period_days=period_days)
    return {"ok": True, "data": data}


@router.get("/metrics/transactions")
async def get_transaction_metrics(
    period_days: int = Query(30, ge=1, le=365),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get transaction metrics."""
    service = MetricsService(db)
    data = await service.get_transaction_metrics(period_days=period_days)
    return {"ok": True, "data": data}


@router.get("/metrics/businesses")
async def get_business_metrics(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get business metrics."""
    service = MetricsService(db)
    data = await service.get_business_metrics()
    return {"ok": True, "data": data}


@router.get("/reports/daily")
async def get_daily_report(
    date: date = Query(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate daily report for a specific date."""
    service = MetricsService(db)
    data = await service.generate_daily_report(date)
    return {"ok": True, "data": data}


# ── PARTNERSHIPS ────────────────────────────────────────────


@router.post("/partnerships/apply")
async def submit_partnership_request(
    company_name: str = Body(...),
    company_type: str = Body(...),
    contact_person: str = Body(...),
    contact_email: str = Body(...),
    contact_phone: str | None = Body(None),
    company_website: str | None = Body(None),
    description: str = Body(...),
    cac_number: str | None = Body(None),
    documents: list | None = Body(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Public endpoint — submit partnership application.
    No authentication required.
    """
    service = PartnershipService(db)
    data = await service.submit_request({
        "company_name": company_name,
        "company_type": company_type,
        "contact_person": contact_person,
        "contact_email": contact_email,
        "contact_phone": contact_phone,
        "company_website": company_website,
        "description": description,
        "cac_number": cac_number,
        "documents": documents or [],
    })
    await db.commit()
    return {"ok": True, "data": data}


@router.get("/partnerships/public")
async def get_public_partnerships(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Public endpoint — get active partnerships.
    No authentication required.
    """
    service = PartnershipService(db)
    data = await service.get_public_partnerships()
    return {"ok": True, "data": data}


@router.get("/partnerships/requests")
async def list_partnership_requests(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List pending partnership requests."""
    service = PartnershipService(db)
    data = await service.list_pending_requests()
    return {"ok": True, "data": data}


@router.get("/partnerships/requests/{request_id}")
async def get_partnership_request(
    request_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get partnership request details."""
    service = PartnershipService(db)
    data = await service.get_request(request_id)
    return {"ok": True, "data": data}


@router.patch("/partnerships/requests/{request_id}")
async def update_partnership_request(
    request_id: UUID,
    status: str | None = Body(None),
    admin_notes: str | None = Body(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update partnership request status and notes."""
    # For now, just update notes
    # Full status transitions are handled by approve/reject endpoints
    from src.models.admin import PartnershipRequest
    request = await db.get(PartnershipRequest, str(request_id))
    if not request:
        raise ZovuAPIError(404, "REQUEST_NOT_FOUND", "Partnership request not found")
    
    if status:
        request.status = status
    if admin_notes:
        request.admin_notes = admin_notes
    
    await db.flush()
    return {"ok": True, "data": {"status": request.status}}


@router.post("/partnerships/requests/{request_id}/approve")
async def approve_partnership_request(
    request_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Approve partnership request."""
    service = PartnershipService(db)
    data = await service.approve_request(request_id, admin.id)
    await db.commit()
    return {"ok": True, "data": data}


@router.post("/partnerships/requests/{request_id}/reject")
async def reject_partnership_request(
    request_id: UUID,
    reason: str = Body(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reject partnership request."""
    service = PartnershipService(db)
    data = await service.reject_request(request_id, admin.id, reason)
    await db.commit()
    return {"ok": True, "data": data}


@router.get("/partnerships")
async def list_partnerships(
    company_type: str | None = Query(None),
    status: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List active partnerships."""
    service = PartnershipService(db)
    data = await service.list_active_partnerships(company_type=company_type, status=status)
    return {"ok": True, "data": data}


@router.put("/partnerships/{partnership_id}")
async def update_partnership(
    partnership_id: UUID,
    logo_url: str | None = Body(None),
    description: str | None = Body(None),
    services: list | None = Body(None),
    featured: bool | None = Body(None),
    display_order: int | None = Body(None),
    status: str | None = Body(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update partnership details."""
    service = PartnershipService(db)
    updates = {}
    if logo_url is not None:
        updates["logo_url"] = logo_url
    if description is not None:
        updates["description"] = description
    if services is not None:
        updates["services"] = services
    if featured is not None:
        updates["featured"] = featured
    if display_order is not None:
        updates["display_order"] = display_order
    if status is not None:
        updates["status"] = status
    
    data = await service.update_partnership(partnership_id, updates, admin.id)
    await db.commit()
    return {"ok": True, "data": data}


# ── AUDIT LOG ───────────────────────────────────────────────


@router.get("/audit-log")
async def get_audit_log(
    admin_id: UUID | None = Query(None),
    action: str | None = Query(None),
    target_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get admin audit log."""
    from sqlalchemy import select
    from src.models.admin import AdminAuditLog
    
    query = select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    
    if admin_id:
        query = query.where(AdminAuditLog.admin_id == str(admin_id))
    if action:
        query = query.where(AdminAuditLog.action == action)
    if target_type:
        query = query.where(AdminAuditLog.target_type == target_type)
    
    # Cursor pagination
    if cursor:
        try:
            cursor_id = UUID(cursor)
            cursor_log = await db.get(AdminAuditLog, str(cursor_id))
            if cursor_log:
                query = query.where(AdminAuditLog.created_at < cursor_log.created_at)
        except (ValueError, TypeError):
            pass
    
    result = await db.execute(query.limit(limit + 1))
    logs = result.scalars().all()
    
    has_more = len(logs) > limit
    if has_more:
        logs = logs[:limit]
    
    data = {
        "data": [
            {
                "id": str(log.id),
                "admin_id": str(log.admin_id),
                "admin_email": log.admin_email,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": str(log.target_id) if log.target_id else None,
                "before_state": log.before_state,
                "after_state": log.after_state,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "has_more": has_more,
        "next_cursor": str(logs[-1].id) if logs else None,
    }

    return {"ok": True, "data": data}


# ── AJO ADMIN ───────────────────────────────────────────────


class AdminCreateAjoRequest(BaseModel):
    name: str
    description: str | None = None
    minimum_deposit: int  # KOBO
    end_date: datetime
    max_members: int = 50


@router.post("/ajo/groups")
async def admin_create_ajo(
    payload: AdminCreateAjoRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Admin-only: create a new Ajo group. A static virtual account is
    auto-assigned from the configured AJO_SQUAD_MERCHANT_ACCOUNT so
    members can deposit funds directly.
    """
    if payload.minimum_deposit <= 0:
        raise ZovuAPIError(400, "INVALID_AMOUNT", "minimum_deposit must be positive (kobo)")
    if payload.end_date <= datetime.now(tz=payload.end_date.tzinfo or None):
        raise ZovuAPIError(400, "INVALID_DATE", "end_date must be in the future")

    merchant = getattr(settings, "AJO_SQUAD_MERCHANT_ACCOUNT", None) or getattr(settings, "SQUAD_MERCHANT_ACCOUNT_NUMBER", None)
    if not merchant:
        raise ZovuAPIError(
            400,
            "MERCHANT_NOT_CONFIGURED",
            "Set AJO_SQUAD_MERCHANT_ACCOUNT in the backend .env to create Ajos.",
        )

    ajo = Ajo(
        name=payload.name,
        description=payload.description,
        organizer_id=admin.id,
        contribution_amount=payload.minimum_deposit,
        contribution_frequency="open",
        max_members=max(2, min(500, payload.max_members)),
        status=AjoStatus.ACTIVE,
        payout_schedule=[],
        end_date=payload.end_date,
        merchant_squad_account=merchant,
    )
    db.add(ajo)
    await db.flush()

    # Audit
    from src.models.admin import AdminAuditLog
    db.add(AdminAuditLog(
        admin_id=admin.id,
        admin_email=admin.email,
        action="ajo.created",
        target_type="ajo",
        target_id=ajo.id,
        before_state={},
        after_state={
            "name": ajo.name,
            "minimum_deposit": ajo.contribution_amount,
            "merchant_squad_account": merchant,
            "end_date": ajo.end_date.isoformat() if ajo.end_date else None,
        },
    ))

    await db.commit()
    await db.refresh(ajo)

    return {"ok": True, "data": {
        "id": ajo.id,
        "name": ajo.name,
        "description": ajo.description,
        "minimum_deposit": ajo.contribution_amount,
        "end_date": ajo.end_date.isoformat() if ajo.end_date else None,
        "max_members": ajo.max_members,
        "merchant_squad_account": ajo.merchant_squad_account,
        "static_va": ajo.merchant_squad_account,
        "status": ajo.status,
    }}


@router.get("/ajo/groups")
async def admin_list_ajo_groups(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (await db.execute(select(Ajo).order_by(Ajo.created_at.desc()))).scalars().all()
    out = []
    for ajo in rows:
        member_count = (await db.execute(
            select(func.count(AjoMembership.id)).where(AjoMembership.ajo_id == ajo.id)
        )).scalar() or 0
        out.append({
            "id": ajo.id,
            "name": ajo.name,
            "description": ajo.description,
            "minimum_deposit": int(ajo.contribution_amount or 0),
            "end_date": ajo.end_date.isoformat() if ajo.end_date else None,
            "total_balance": int(ajo.total_balance or 0),
            "member_count": member_count,
            "max_members": ajo.max_members,
            "status": ajo.status,
            "merchant_squad_account": ajo.merchant_squad_account,
            "created_at": ajo.created_at.isoformat() if ajo.created_at else None,
        })
    return {"ok": True, "data": out}


# ── LENDER / PARTNER APPROVAL ──────────────────────────────


@router.get("/partners/pending")
async def list_pending_partners(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List lender/partner accounts awaiting admin approval."""
    q = (
        select(User)
        .where(User.role == "lender")
        .where(User.partner_approved == False)  # noqa: E712
        .where(User.is_banned == False)  # noqa: E712
        .order_by(User.created_at.desc())
    )
    rows = (await db.execute(q)).scalars().all()
    return {"ok": True, "data": [
        {
            "id": u.id,
            "email": u.email,
            "company_name": u.company_name,
            "full_name": u.full_name,
            "email_verified": bool(u.email_verified),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in rows
    ]}


@router.post("/partners/{user_id}/approve")
async def approve_partner(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark a lender/partner account as approved so they can post services."""
    user = await db.get(User, str(user_id))
    if not user or (user.role or "").lower() != "lender":
        raise ZovuAPIError(404, "USER_NOT_FOUND", "Partner account not found")
    if user.partner_approved:
        return {"ok": True, "data": {"id": user.id, "partner_approved": True}}

    user.partner_approved = True
    user.partner_approved_at = datetime.now(timezone.utc)

    from src.models.admin import AdminAuditLog
    db.add(AdminAuditLog(
        admin_id=admin.id,
        admin_email=admin.email,
        action="partner.approved",
        target_type="user",
        target_id=user.id,
        before_state={"partner_approved": False},
        after_state={"partner_approved": True},
    ))

    await db.commit()

    # Best-effort notification email
    try:
        from src.services.email_service import EmailService
        from src.config import settings as _s
        svc = EmailService()
        html = (
            f"<html><body style='font-family:DM Sans,sans-serif;'>"
            f"<h2>You're approved!</h2>"
            f"<p>Hi {user.company_name or 'partner'},</p>"
            f"<p>Your Zovu partner account has been approved. You can now post loan or insurance services from your dashboard.</p>"
            f"<p>— The Zovu team</p>"
            f"</body></html>"
        )
        await svc._send(user.email, "Your Zovu partner account is approved", html)
    except Exception:
        pass

    return {"ok": True, "data": {"id": user.id, "partner_approved": True}}


@router.post("/partners/{user_id}/revoke")
async def revoke_partner(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Revoke partner approval (account cannot post new services)."""
    user = await db.get(User, str(user_id))
    if not user or (user.role or "").lower() != "lender":
        raise ZovuAPIError(404, "USER_NOT_FOUND", "Partner account not found")
    user.partner_approved = False
    user.partner_approved_at = None

    from src.models.admin import AdminAuditLog
    db.add(AdminAuditLog(
        admin_id=admin.id,
        admin_email=admin.email,
        action="partner.revoked",
        target_type="user",
        target_id=user.id,
        before_state={"partner_approved": True},
        after_state={"partner_approved": False},
    ))
    await db.commit()
    return {"ok": True, "data": {"id": user.id, "partner_approved": False}}


# ── ADMIN-FILED COMPLAINTS / FRAUD-FIELD AUDIT ─────────────


@router.get("/fraud/users/{user_id}/fields")
async def get_user_fraud_fields(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return all fields used in fraud detection for a user — used by the admin
    fraud screen so reviewers can see what signals contributed to the risk
    score.
    """
    from src.services.fraud_service import FraudService
    from src.models import UserFlag, Transaction, Device
    from sqlalchemy import and_, or_

    user = await db.get(User, str(user_id))
    if not user:
        raise ZovuAPIError(404, "USER_NOT_FOUND", "User not found")

    svc = FraudService(db)
    score = await svc.calculate_fraud_score(user_id)

    flags_q = select(UserFlag).where(UserFlag.user_id == str(user_id)).order_by(UserFlag.created_at.desc())
    flags = (await db.execute(flags_q)).scalars().all()

    failed_tx_q = select(func.count(Transaction.id)).where(
        and_(
            or_(Transaction.sender_id == str(user_id), Transaction.receiver_id == str(user_id)),
            Transaction.status == "FAILED",
        )
    )
    failed_tx = (await db.execute(failed_tx_q)).scalar() or 0

    device_count_q = select(func.count(Device.id)).where(Device.user_id == str(user_id))
    device_count = (await db.execute(device_count_q)).scalar() or 0

    return {"ok": True, "data": {
        "user_id": user.id,
        "fraud_risk_score": score,
        "is_banned": bool(user.is_banned),
        "ban_reason": user.ban_reason,
        "kyc_verified": bool(user.kyc_verified),
        "email": user.email,
        "role": user.role,
        "pulse_score": int(user.pulse_score or 0),
        "compliance_flags": user.compliance_flags or [],
        "failed_transactions_total": int(failed_tx),
        "devices_count": int(device_count),
        "active_flags": [
            {
                "id": f.id,
                "reason": f.flag_reason,
                "risk_score": f.fraud_risk_score,
                "status": f.flag_status,
                "flagged_by": f.flagged_by,
                "admin_notes": f.admin_notes,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in flags
        ],
        "weights": {
            "complaint_weight": FraudService.COMPLAINT_WEIGHT,
            "chargeback_weight": FraudService.CHARGEBACK_WEIGHT,
            "failed_tx_weight": FraudService.FAILED_TX_WEIGHT,
            "device_anomaly_weight": FraudService.DEVICE_ANOMALY_WEIGHT,
            "normalization_divisor": FraudService.NORMALIZATION_DIVISOR,
        },
    }}


@router.get("/squad/health")
async def admin_squad_health(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache_dep),
) -> dict:
    """
    Confirm the Squad sandbox/live keys are wired up correctly.

    Runs three cheap reachability checks:
      1. config values are populated
      2. an HTTPS GET to SQUAD_BASE_URL returns *something* (network OK)
      3. a /payout/account/lookup against a known-good GTBank test account
         exercises the authenticated POST path with no money movement.

    Use this from .ps1 before assuming a 502 on /ajo/contribute is a Squad
    outage — usually it's a missing or rotated key.
    """
    import httpx
    from src.services.squad import SquadService

    result: dict = {
        "base_url": settings.SQUAD_BASE_URL,
        "secret_key_set": bool(settings.SQUAD_SECRET_KEY),
        "public_key_set": bool(settings.SQUAD_PUBLIC_KEY),
        "merchant_account_set": bool(settings.AJO_SQUAD_MERCHANT_ACCOUNT),
        "merchant_account": settings.AJO_SQUAD_MERCHANT_ACCOUNT or None,
        "reachable": False,
        "lookup_ok": False,
        "lookup_error": None,
    }

    if not (result["secret_key_set"] and result["public_key_set"]):
        return {"ok": True, "data": result, "warning": "Squad keys are missing in .env"}

    # 1. Cheap reachability check
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            ping = await http.get(settings.SQUAD_BASE_URL)
            result["reachable"] = True
            result["ping_status"] = ping.status_code
    except Exception as exc:
        result["reachable"] = False
        result["ping_error"] = str(exc)
        return {"ok": True, "data": result, "warning": "Squad base URL is not reachable"}

    # 2. Authenticated NIBSS lookup against a known-good GTBank test account.
    #    Squad's /payout/account/lookup takes the 6-character NIBSS NIP code
    #    ("000013" = GTBank), not the 3-character CBN sort code. In sandbox,
    #    Squad commonly returns 424 "Unable to look up name" because NIBSS
    #    lookups aren't fully mocked — that still proves auth/routing work.
    try:
        async with httpx.AsyncClient(timeout=20.0) as http:
            squad = SquadService(http=http, db=db, redis=redis)
            lookup = await squad.lookup_account("0123456789", "000013")
        result["lookup_ok"] = True
        result["lookup_account_name"] = lookup.get("account_name")
        result["lookup_bank_code"] = "000013 (GTBank NIP)"
    except Exception as exc:
        msg = str(exc)
        result["lookup_error"] = msg
        if "424" in msg or "Unable to look up name" in msg:
            # Auth + payload format are correct, sandbox just can't resolve
            # the test pair. Treat as healthy.
            result["lookup_ok"] = True
            result["lookup_note"] = (
                "Squad accepted the request but cannot resolve the sandbox test "
                "pair (NIBSS lookup is not fully mocked). Auth and request "
                "format are OK — production lookups will work."
            )
        else:
            result["lookup_ok"] = False

    return {"ok": True, "data": result}


@router.get("/ajo/transactions")
async def admin_list_ajo_transactions(
    limit: int = Query(100, ge=1, le=500),
    ajo_id: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    q = select(AjoTransaction, Ajo, User).join(Ajo, Ajo.id == AjoTransaction.ajo_id).join(User, User.id == AjoTransaction.user_id)
    if ajo_id:
        q = q.where(AjoTransaction.ajo_id == ajo_id)
    q = q.order_by(AjoTransaction.created_at.desc()).limit(limit)
    rows = (await db.execute(q)).all()
    return {"ok": True, "data": [
        {
            "id": tx.id,
            "ajo_id": tx.ajo_id,
            "ajo_name": ajo.name,
            "user_id": tx.user_id,
            "user_email": user.email,
            "amount": tx.amount,
            "type": tx.type,
            "status": tx.status,
            "timestamp": tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx, ajo, user in rows
    ]}
