"""
Partnership management service.
Handles partnership applications, approvals, and active partnerships.
"""
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone
import structlog

from src.models.admin import PartnershipRequest, Partnership, AdminAuditLog
from src.models.base import User
from src.services.email_service import EmailService
from src.core.exceptions import ZovuAPIError

logger = structlog.get_logger()


class PartnershipService:
    """Partnership management service."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_service = EmailService()

    async def submit_request(self, data: dict) -> dict:
        """
        Public endpoint — accept partnership applications.
        Validate: contact_email is unique in partnership_requests.
        Send confirmation and admin notification emails.
        """
        contact_email = data.get("contact_email", "").lower().strip()

        # Check for duplicates
        existing_query = select(PartnershipRequest).where(
            PartnershipRequest.contact_email == contact_email
        )
        existing = await self.db.execute(existing_query)
        if existing.scalar_one_or_none():
            raise ZovuAPIError(409, "DUPLICATE_APPLICATION", "An application from this email already exists")

        # Create request
        request = PartnershipRequest(
            company_name=data.get("company_name", ""),
            company_type=data.get("company_type", "other"),
            contact_person=data.get("contact_person", ""),
            contact_email=contact_email,
            contact_phone=data.get("contact_phone"),
            company_website=data.get("company_website"),
            description=data.get("description", ""),
            cac_number=data.get("cac_number"),
            documents=data.get("documents", []),
            status="pending",
        )
        self.db.add(request)
        await self.db.flush()

        # Send confirmation email to applicant
        try:
            await self.email_service.send_email(
                to=contact_email,
                subject="ZOVU — We've received your partnership request",
                html=self._partnership_received_template(
                    data.get("contact_person", ""),
                    data.get("company_name", ""),
                ),
            )
        except Exception as e:
            logger.error("partnership_confirmation_email_failed", error=str(e), email=contact_email)

        # Send notification email to admin
        try:
            from src.config import settings
            await self.email_service.send_email(
                to=settings.FROM_EMAIL,
                subject=f"New Partnership Request: {data.get('company_name', 'Unknown')}",
                html=self._partnership_admin_notification_template(
                    data.get("company_name", ""),
                    data.get("company_type", ""),
                    data.get("contact_person", ""),
                    contact_email,
                ),
            )
        except Exception as e:
            logger.error("partnership_admin_email_failed", error=str(e))

        logger.info("partnership_request_submitted", request_id=str(request.id), company=data.get("company_name"))

        return {
            "request_id": str(request.id),
            "status": "pending",
            "created_at": request.created_at.isoformat(),
        }

    async def list_pending_requests(self) -> dict:
        """
        List pending and under_review partnership requests.
        Ordered newest first.
        """
        query = select(PartnershipRequest).where(
            PartnershipRequest.status.in_(["pending", "under_review"])
        ).order_by(PartnershipRequest.created_at.desc())

        result = await self.db.execute(query)
        requests = result.scalars().all()

        return {
            "data": [self._to_dict(r) for r in requests],
        }

    async def get_request(self, request_id: UUID | str) -> dict:
        """Get full partnership request detail."""
        request_id = str(request_id)
        request = await self.db.get(PartnershipRequest, request_id)

        if not request:
            raise ZovuAPIError(404, "REQUEST_NOT_FOUND", "Partnership request not found")

        return self._to_dict(request)

    async def approve_request(self, request_id: UUID | str, admin_id: UUID | str) -> dict:
        """
        Approve partnership request.
        1. Set request status to 'approved'
        2. Create partnership record
        3. Send approval email
        4. Log action
        """
        request_id = str(request_id)
        admin_id = str(admin_id)

        request = await self.db.get(PartnershipRequest, request_id)
        if not request:
            raise ZovuAPIError(404, "REQUEST_NOT_FOUND", "Partnership request not found")

        if request.status == "approved":
            raise ZovuAPIError(409, "ALREADY_APPROVED", "Request is already approved")

        # Update request
        request.status = "approved"
        request.reviewed_at = datetime.now(timezone.utc)
        request.reviewer_id = admin_id
        request.published_at = datetime.now(timezone.utc)

        # Create partnership
        partnership = Partnership(
            request_id=request_id,
            company_name=request.company_name,
            company_type=request.company_type,
            contact_email=request.contact_email,
            description=request.description,
            services=request.documents,  # Use documents as services initially
            status="active",
        )
        self.db.add(partnership)
        await self.db.flush()

        # Send approval email
        try:
            await self.email_service.send_email(
                to=request.contact_email,
                subject="Your ZOVU Partnership Request Has Been Approved! 🎉",
                html=self._partnership_approved_template(
                    request.contact_person,
                    request.company_name,
                    request.company_type,
                ),
            )
        except Exception as e:
            logger.error("partnership_approval_email_failed", error=str(e), request_id=request_id)

        # Log action
        admin = await self.db.get(User, admin_id)
        await self._log_admin_action(
            admin_id=admin_id,
            admin_email=admin.email if admin else "unknown",
            action="partnership.approved",
            target_type="partnership",
            target_id=str(partnership.id),
            before_state={"status": "pending"},
            after_state={"status": "active"},
        )

        logger.info("partnership_request_approved", request_id=request_id, partnership_id=str(partnership.id))

        return self._partnership_to_dict(partnership)

    async def reject_request(
        self,
        request_id: UUID | str,
        admin_id: UUID | str,
        reason: str,
    ) -> dict:
        """
        Reject partnership request.
        Send rejection email and log action.
        """
        request_id = str(request_id)
        admin_id = str(admin_id)

        request = await self.db.get(PartnershipRequest, request_id)
        if not request:
            raise ZovuAPIError(404, "REQUEST_NOT_FOUND", "Partnership request not found")

        if request.status == "rejected":
            raise ZovuAPIError(409, "ALREADY_REJECTED", "Request is already rejected")

        # Update request
        request.status = "rejected"
        request.rejection_reason = reason
        request.reviewed_at = datetime.now(timezone.utc)
        request.reviewer_id = admin_id

        await self.db.flush()

        # Send rejection email
        try:
            await self.email_service.send_email(
                to=request.contact_email,
                subject="ZOVU Partnership Request Update",
                html=self._partnership_rejected_template(
                    request.contact_person,
                    request.company_name,
                    reason,
                ),
            )
        except Exception as e:
            logger.error("partnership_rejection_email_failed", error=str(e), request_id=request_id)

        # Log action
        admin = await self.db.get(User, admin_id)
        await self._log_admin_action(
            admin_id=admin_id,
            admin_email=admin.email if admin else "unknown",
            action="partnership.rejected",
            target_type="partnership_request",
            target_id=request_id,
            before_state={"status": "pending"},
            after_state={"status": "rejected", "rejection_reason": reason},
        )

        logger.info("partnership_request_rejected", request_id=request_id, reason=reason)

        return self._to_dict(request)

    async def list_active_partnerships(
        self,
        company_type: str | None = None,
        status: str | None = None,
    ) -> dict:
        """
        List active partnerships.
        Ordered by featured DESC, display_order ASC.
        """
        query = select(Partnership).order_by(
            Partnership.featured.desc(),
            Partnership.display_order.asc(),
        )

        if company_type:
            query = query.where(Partnership.company_type == company_type)
        if status:
            query = query.where(Partnership.status == status)
        else:
            query = query.where(Partnership.status == "active")

        result = await self.db.execute(query)
        partnerships = result.scalars().all()

        return {
            "data": [self._partnership_to_dict(p) for p in partnerships],
        }

    async def update_partnership(
        self,
        partnership_id: UUID | str,
        updates: dict,
        admin_id: UUID | str,
    ) -> dict:
        """
        Update partnership details.
        Allowed fields: logo_url, description, services, terms, featured, display_order, status.
        """
        partnership_id = str(partnership_id)
        admin_id = str(admin_id)

        partnership = await self.db.get(Partnership, partnership_id)
        if not partnership:
            raise ZovuAPIError(404, "PARTNERSHIP_NOT_FOUND", "Partnership not found")

        before_state = {
            "featured": partnership.featured,
            "display_order": partnership.display_order,
            "status": partnership.status,
        }

        # Allowed fields to update
        allowed_fields = ["logo_url", "description", "services", "terms", "featured", "display_order", "status"]
        for field in allowed_fields:
            if field in updates:
                setattr(partnership, field, updates[field])

        await self.db.flush()

        after_state = {
            "featured": partnership.featured,
            "display_order": partnership.display_order,
            "status": partnership.status,
        }

        # Log action
        admin = await self.db.get(User, admin_id)
        await self._log_admin_action(
            admin_id=admin_id,
            admin_email=admin.email if admin else "unknown",
            action="partnership.updated",
            target_type="partnership",
            target_id=partnership_id,
            before_state=before_state,
            after_state=after_state,
        )

        logger.info("partnership_updated", partnership_id=partnership_id)

        return self._partnership_to_dict(partnership)

    async def get_public_partnerships(self) -> list:
        """
        PUBLIC endpoint — no auth required.
        Return active partnerships only, ordered by featured + display_order.
        """
        query = select(Partnership).where(
            Partnership.status == "active"
        ).order_by(
            Partnership.featured.desc(),
            Partnership.display_order.asc(),
        )

        result = await self.db.execute(query)
        partnerships = result.scalars().all()

        return [self._partnership_to_dict(p) for p in partnerships]

    # ── Helpers ──

    def _to_dict(self, request: PartnershipRequest) -> dict:
        """Convert partnership request to dict."""
        return {
            "id": str(request.id),
            "company_name": request.company_name,
            "company_type": request.company_type,
            "contact_person": request.contact_person,
            "contact_email": request.contact_email,
            "contact_phone": request.contact_phone,
            "company_website": request.company_website,
            "description": request.description,
            "cac_number": request.cac_number,
            "documents": request.documents,
            "status": request.status,
            "admin_notes": request.admin_notes,
            "rejection_reason": request.rejection_reason,
            "reviewed_at": request.reviewed_at.isoformat() if request.reviewed_at else None,
            "published_at": request.published_at.isoformat() if request.published_at else None,
            "created_at": request.created_at.isoformat(),
        }

    def _partnership_to_dict(self, partnership: Partnership) -> dict:
        """Convert partnership to dict."""
        return {
            "id": str(partnership.id),
            "request_id": str(partnership.request_id) if partnership.request_id else None,
            "company_name": partnership.company_name,
            "company_type": partnership.company_type,
            "contact_email": partnership.contact_email,
            "logo_url": partnership.logo_url,
            "description": partnership.description,
            "services": partnership.services,
            "terms": partnership.terms,
            "status": partnership.status,
            "featured": partnership.featured,
            "display_order": partnership.display_order,
            "metrics": partnership.metrics,
            "created_at": partnership.created_at.isoformat(),
            "updated_at": partnership.updated_at.isoformat(),
        }

    async def _log_admin_action(
        self,
        admin_id: str,
        admin_email: str,
        action: str,
        target_type: str,
        target_id: str,
        before_state: dict | None = None,
        after_state: dict | None = None,
    ) -> None:
        """Log admin action to audit log."""
        audit = AdminAuditLog(
            admin_id=admin_id,
            admin_email=admin_email,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_state=before_state,
            after_state=after_state,
        )
        self.db.add(audit)
        await self.db.flush()

    def _partnership_received_template(self, contact_person: str, company_name: str) -> str:
        """Email template for partnership application received."""
        return f"""
        <html>
        <body style="font-family: DM Sans, sans-serif; color: #1a1a1a;">
            <p>Hi {contact_person},</p>
            <p>We've received your partnership request for {company_name}.</p>
            <p>Our team will review your application and respond within 3-5 business days.</p>
            <p>— The ZOVU Partnerships Team</p>
        </body>
        </html>
        """

    def _partnership_approved_template(self, contact_person: str, company_name: str, company_type: str) -> str:
        """Email template for partnership approved."""
        return f"""
        <html>
        <body style="font-family: DM Sans, sans-serif; color: #1a1a1a;">
            <p>Hi {contact_person},</p>
            <p>Your partnership request for {company_name} has been approved! 🎉</p>
            <p>{company_name} is now live on the ZOVU platform as a {company_type} partner.</p>
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>We'll contact you within 24 hours to set up your dashboard.</li>
                <li>Your partnership details are now visible to ZOVU users.</li>
            </ul>
            <p>Welcome to the ZOVU family!</p>
            <p>— The ZOVU Partnerships Team</p>
        </body>
        </html>
        """

    def _partnership_rejected_template(self, contact_person: str, company_name: str, reason: str) -> str:
        """Email template for partnership rejected."""
        return f"""
        <html>
        <body style="font-family: DM Sans, sans-serif; color: #1a1a1a;">
            <p>Hi {contact_person},</p>
            <p>Thank you for your interest in partnering with ZOVU.</p>
            <p>After review, we are unable to approve {company_name}'s partnership request at this time.</p>
            <p><strong>Reason:</strong> {reason}</p>
            <p>You are welcome to reapply in the future with updated information.</p>
            <p>— The ZOVU Partnerships Team</p>
        </body>
        </html>
        """

    def _partnership_admin_notification_template(
        self,
        company_name: str,
        company_type: str,
        contact_person: str,
        contact_email: str,
    ) -> str:
        """Admin notification email for new partnership request."""
        return f"""
        <html>
        <body style="font-family: DM Sans, sans-serif; color: #1a1a1a;">
            <p>New Partnership Request</p>
            <ul>
                <li><strong>Company:</strong> {company_name}</li>
                <li><strong>Type:</strong> {company_type}</li>
                <li><strong>Contact:</strong> {contact_person}</li>
                <li><strong>Email:</strong> {contact_email}</li>
            </ul>
            <p>Please review in the admin dashboard.</p>
        </body>
        </html>
        """
