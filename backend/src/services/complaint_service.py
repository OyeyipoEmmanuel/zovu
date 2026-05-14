"""
Complaint management service for admin dashboard.
Handles complaint lifecycle, Squad verification, and notifications.
"""
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from redis import Redis
from uuid import UUID
from datetime import datetime, timezone, timedelta
import structlog

from src.models.admin import Complaint, AdminAuditLog
from src.models.base import User, Transaction
from src.core.redis_client import redis_client
from src.services.email_service import EmailService
from src.core.exceptions import ZovuAPIError

logger = structlog.get_logger()


class ComplaintService:
    """Complaint management service."""

    def __init__(self, db: AsyncSession, redis: Redis | None = None):
        self.db = db
        self.redis = redis
        self.email_service = EmailService()

    async def list_complaints(
        self,
        status: str | None = None,
        urgency: str | None = None,
        category: str | None = None,
        limit: int = 20,
        cursor: str | None = None
    ) -> dict:
        """
        List complaints with cursor-based pagination.
        Ordered by created_at DESC.
        """
        query = select(Complaint).order_by(Complaint.created_at.desc())

        # Apply filters
        if status:
            query = query.where(Complaint.status == status)
        if urgency:
            query = query.where(Complaint.urgency == urgency)
        if category:
            query = query.where(Complaint.category == category)

        # Cursor pagination
        if cursor:
            try:
                cursor_id = UUID(cursor)
                cursor_complaint = await self.db.get(Complaint, str(cursor_id))
                if cursor_complaint:
                    query = query.where(Complaint.created_at < cursor_complaint.created_at)
            except (ValueError, TypeError):
                pass

        result = await self.db.execute(query.limit(limit + 1))
        complaints = result.scalars().all()

        has_more = len(complaints) > limit
        if has_more:
            complaints = complaints[:limit]

        return {
            "data": [self._to_dict(c) for c in complaints],
            "has_more": has_more,
            "next_cursor": str(complaints[-1].id) if complaints else None,
        }

    async def get_complaint(self, complaint_id: UUID | str) -> dict:
        """Get full complaint detail including complainant and audit history."""
        complaint_id = str(complaint_id)
        complaint = await self.db.get(Complaint, complaint_id)

        if not complaint:
            raise ZovuAPIError(404, "COMPLAINT_NOT_FOUND", "Complaint not found")

        # Get complainant
        complainant = await self.db.get(User, complaint.complainant_id)
        
        # Get transaction
        tx = await self.db.get(Transaction, complaint.transaction_id)

        # Get audit history
        audit_query = select(AdminAuditLog).where(
            AdminAuditLog.target_id == complaint_id,
            AdminAuditLog.target_type == "complaint"
        ).order_by(AdminAuditLog.created_at.desc())
        audit_result = await self.db.execute(audit_query)
        audit_logs = audit_result.scalars().all()

        return {
            **self._to_dict(complaint),
            "complainant": {
                "id": str(complainant.id),
                "display_name": f"{complainant.first_name or ''} {complainant.last_name or ''}".strip(),
                "user_type": complainant.user_type,
            },
            "transaction": {
                "id": str(tx.id),
                "amount": tx.amount_gross,
                "status": tx.status,
                "created_at": tx.created_at.isoformat(),
            },
            "audit_history": [
                {
                    "action": log.action,
                    "admin_email": log.admin_email,
                    "created_at": log.created_at.isoformat(),
                    "changes": {
                        "before": log.before_state,
                        "after": log.after_state,
                    }
                }
                for log in audit_logs
            ]
        }

    async def create_complaint(
        self,
        complainant_id: UUID | str,
        transaction_id: UUID | str,
        category: str,
        description: str,
        urgency: str = "medium"
    ) -> dict:
        """
        User files a complaint. Validate transaction belongs to complainant.
        """
        complainant_id = str(complainant_id)
        transaction_id = str(transaction_id)

        # Verify transaction exists and belongs to complainant
        tx = await self.db.get(Transaction, transaction_id)
        if not tx:
            raise ZovuAPIError(404, "TRANSACTION_NOT_FOUND", "Transaction not found")

        if str(tx.sender_id) != complainant_id and str(tx.receiver_id) != complainant_id:
            raise ZovuAPIError(403, "TRANSACTION_MISMATCH", "You can only file complaints about your own transactions")

        # Create complaint
        complaint = Complaint(
            complainant_id=complainant_id,
            transaction_id=transaction_id,
            category=category,
            description=description,
            urgency=urgency,
            status="new",
        )
        self.db.add(complaint)
        await self.db.flush()

        logger.info("complaint_created", complaint_id=str(complaint.id), complainant_id=complainant_id)

        return self._to_dict(complaint)

    async def verify_with_squad(self, complaint_id: UUID | str, admin_id: UUID | str) -> dict:
        """
        Call Squad API to check transaction status.
        Store raw response and return structured report.
        """
        complaint_id = str(complaint_id)
        admin_id = str(admin_id)

        complaint = await self.db.get(Complaint, complaint_id)
        if not complaint:
            raise ZovuAPIError(404, "COMPLAINT_NOT_FOUND", "Complaint not found")

        # TODO: Call Squad API with transaction reference
        # For now, return mock response
        squad_response = {
            "transaction_found": True,
            "squad_status": "completed",
            "sender_debited": True,
            "recipient_credited": True,
        }

        complaint.squad_verified_at = datetime.now(timezone.utc)
        complaint.squad_verification_result = squad_response

        await self._log_admin_action(
            admin_id=admin_id,
            action="complaint.squad_verified",
            target_type="complaint",
            target_id=complaint_id,
            before_state={"squad_verified_at": None},
            after_state={"squad_verified_at": complaint.squad_verified_at.isoformat()},
        )

        return {
            "transaction_found": squad_response.get("transaction_found"),
            "squad_status": squad_response.get("squad_status"),
            "sender_debited": squad_response.get("sender_debited"),
            "recipient_credited": squad_response.get("recipient_credited"),
            "mismatch_with_complaint": not (
                squad_response.get("sender_debited") and squad_response.get("recipient_credited")
            ),
            "verified_at": complaint.squad_verified_at.isoformat(),
        }

    async def update_complaint(
        self,
        complaint_id: UUID | str,
        status: str | None = None,
        resolution: str | None = None,
        admin_notes: str | None = None,
        admin_id: UUID | str | None = None,
    ) -> dict:
        """
        Update complaint status, resolution, and notes.
        If status == "resolved", set resolved_at + resolved_by.
        Log to audit log.
        """
        complaint_id = str(complaint_id)
        admin_id = str(admin_id) if admin_id else None

        complaint = await self.db.get(Complaint, complaint_id)
        if not complaint:
            raise ZovuAPIError(404, "COMPLAINT_NOT_FOUND", "Complaint not found")

        before_state = {
            "status": complaint.status,
            "resolution": complaint.resolution,
            "admin_notes": complaint.admin_notes,
        }

        if status:
            complaint.status = status
        if resolution:
            complaint.resolution = resolution
        if admin_notes is not None:
            complaint.admin_notes = admin_notes

        if status == "resolved":
            complaint.resolved_at = datetime.now(timezone.utc)
            complaint.resolved_by = admin_id

        await self.db.flush()

        after_state = {
            "status": complaint.status,
            "resolution": complaint.resolution,
            "admin_notes": complaint.admin_notes,
        }

        if admin_id:
            admin = await self.db.get(User, admin_id)
            admin_email = admin.email if admin else "unknown"
            
            await self._log_admin_action(
                admin_id=admin_id,
                admin_email=admin_email,
                action="complaint.updated",
                target_type="complaint",
                target_id=complaint_id,
                before_state=before_state,
                after_state=after_state,
            )

        # Send notification email if resolved
        if status == "resolved":
            complainant = await self.db.get(User, complaint.complainant_id)
            if complainant and complainant.email:
                resolution_label = complaint.resolution or "resolved"
                try:
                    await self.email_service.send_email(
                        to=complainant.email,
                        subject="Your ZOVU complaint has been resolved",
                        html=self._complaint_resolved_template(
                            first_name=complainant.first_name or "there",
                            complaint_id_short=str(complaint.id)[:8],
                            resolution_label=resolution_label,
                            admin_notes=complaint.admin_notes or "Thank you for your patience.",
                        )
                    )
                except Exception as e:
                    logger.error("complaint_email_failed", error=str(e), complaint_id=complaint_id)

        return self._to_dict(complaint)

    async def get_complaint_stats(self) -> dict:
        """
        Return complaint statistics.
        Cache in Redis for 5 minutes.
        """
        cache_key = "admin:complaints:stats"
        
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                import json
                return json.loads(cached)

        # Count by status
        total_result = await self.db.execute(select(func.count(Complaint.id)))
        total = total_result.scalar() or 0

        new_result = await self.db.execute(
            select(func.count(Complaint.id)).where(Complaint.status == "new")
        )
        new = new_result.scalar() or 0

        investigating_result = await self.db.execute(
            select(func.count(Complaint.id)).where(Complaint.status == "investigating")
        )
        investigating = investigating_result.scalar() or 0

        today = datetime.now(timezone.utc).date()
        resolved_today_result = await self.db.execute(
            select(func.count(Complaint.id)).where(
                and_(
                    Complaint.status == "resolved",
                    func.cast(Complaint.resolved_at, func.DATE) == today
                )
            )
        )
        resolved_today = resolved_today_result.scalar() or 0

        # Average resolution time
        avg_hours_result = await self.db.execute(
            select(
                func.avg(
                    func.extract('epoch', Complaint.resolved_at - Complaint.created_at) / 3600
                )
            ).where(Complaint.resolved_at.isnot(None))
        )
        avg_hours = avg_hours_result.scalar() or 0

        stats = {
            "total": total,
            "new": new,
            "investigating": investigating,
            "resolved_today": resolved_today,
            "avg_resolution_hours": float(avg_hours),
        }

        if self.redis:
            import json
            await self.redis.setex(cache_key, 300, json.dumps(stats))

        return stats

    # ── Helpers ──

    def _to_dict(self, complaint: Complaint) -> dict:
        """Convert complaint to dict."""
        return {
            "id": str(complaint.id),
            "complainant_id": str(complaint.complainant_id),
            "transaction_id": str(complaint.transaction_id),
            "category": complaint.category,
            "description": complaint.description,
            "status": complaint.status,
            "urgency": complaint.urgency,
            "resolution": complaint.resolution,
            "admin_notes": complaint.admin_notes,
            "resolved_at": complaint.resolved_at.isoformat() if complaint.resolved_at else None,
            "resolved_by": str(complaint.resolved_by) if complaint.resolved_by else None,
            "squad_verified_at": complaint.squad_verified_at.isoformat() if complaint.squad_verified_at else None,
            "squad_verification_result": complaint.squad_verification_result,
            "created_at": complaint.created_at.isoformat(),
            "updated_at": complaint.updated_at.isoformat(),
        }

    async def _log_admin_action(
        self,
        admin_id: str,
        action: str,
        target_type: str,
        target_id: str,
        before_state: dict | None = None,
        after_state: dict | None = None,
        admin_email: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Log admin action to audit log."""
        if not admin_email:
            admin = await self.db.get(User, admin_id)
            admin_email = admin.email if admin else "unknown"

        audit = AdminAuditLog(
            admin_id=admin_id,
            admin_email=admin_email,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_state=before_state,
            after_state=after_state,
            ip_address=ip_address,
        )
        self.db.add(audit)
        await self.db.flush()

    def _complaint_resolved_template(self, first_name: str, complaint_id_short: str, resolution_label: str, admin_notes: str) -> str:
        """HTML template for complaint resolved email."""
        return f"""
        <html>
        <body style="font-family: DM Sans, sans-serif; color: #1a1a1a;">
            <p>Hi {first_name},</p>
            <p>Your complaint (#{complaint_id_short}) has been <strong>{resolution_label}</strong>.</p>
            <p><strong>Resolution:</strong> {admin_notes}</p>
            <p>If you have further questions, reply to this email.</p>
            <p>— The ZOVU Support Team</p>
        </body>
        </html>
        """
