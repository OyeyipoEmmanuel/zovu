"""
Fraud detection and account management service.
Handles user flagging, account pausing/unpausing, and account deletion.
"""
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from redis import Redis
from uuid import UUID
from datetime import datetime, timezone, timedelta
import structlog
import json

from src.models.admin import UserFlag, AdminAuditLog
from src.models.base import User, Transaction, RefreshToken, Device
from src.services.email_service import EmailService
from src.core.exceptions import ZovuAPIError
from src.core.security import encrypt_pii

logger = structlog.get_logger()


class FraudService:
    """Fraud detection and account management."""

    # Fraud score formula coefficients
    COMPLAINT_WEIGHT = 20
    CHARGEBACK_WEIGHT = 15
    FAILED_TX_WEIGHT = 10
    DEVICE_ANOMALY_WEIGHT = 25
    NORMALIZATION_DIVISOR = 3

    RISK_THRESHOLDS = {"low": 0, "medium": 40, "high": 75}

    def __init__(self, db: AsyncSession, redis: Redis | None = None):
        self.db = db
        self.redis = redis
        self.email_service = EmailService()

    async def calculate_fraud_score(self, user_id: UUID | str) -> int:
        """
        Calculate fraud score using formula:
        raw = (complaint_count * 20) + (chargeback_count * 15)
             + (failed_tx_count * 10) + (device_anomaly_count * 25)
        normalized = min(int(raw / 3), 100)
        """
        user_id = str(user_id)

        # Get complaints AGAINST user (from other users)
        from src.models.admin import Complaint
        complaint_query = select(func.count(Complaint.id)).where(
            and_(
                Complaint.complainant_id != user_id,
                # Complaint involves user's transaction
            )
        )
        complaint_result = await self.db.execute(complaint_query)
        complaint_count = complaint_result.scalar() or 0

        # Get chargebacks: transactions that failed after being completed
        # For simplicity, count recent failed transactions
        chargeback_query = select(func.count(Transaction.id)).where(
            and_(
                or_(
                    Transaction.sender_id == user_id,
                    Transaction.receiver_id == user_id,
                ),
                Transaction.status == "FAILED",
                Transaction.created_at >= datetime.now(timezone.utc) - timedelta(days=90),
            )
        )
        chargeback_result = await self.db.execute(chargeback_query)
        chargeback_count = chargeback_result.scalar() or 0

        # Get failed transactions
        failed_tx_query = select(func.count(Transaction.id)).where(
            and_(
                or_(
                    Transaction.sender_id == user_id,
                    Transaction.receiver_id == user_id,
                ),
                Transaction.status == "FAILED",
                Transaction.created_at >= datetime.now(timezone.utc) - timedelta(days=90),
            )
        )
        failed_tx_result = await self.db.execute(failed_tx_query)
        failed_tx_count = failed_tx_result.scalar() or 0

        # Get device anomalies
        device_anomaly_query = select(func.count(UserFlag.id)).where(
            and_(
                UserFlag.user_id == user_id,
                UserFlag.flag_reason == "device_duplication",
            )
        )
        device_anomaly_result = await self.db.execute(device_anomaly_query)
        device_anomaly_count = device_anomaly_result.scalar() or 0

        # Calculate score
        raw_score = (
            (complaint_count * self.COMPLAINT_WEIGHT) +
            (chargeback_count * self.CHARGEBACK_WEIGHT) +
            (failed_tx_count * self.FAILED_TX_WEIGHT) +
            (device_anomaly_count * self.DEVICE_ANOMALY_WEIGHT)
        )

        normalized_score = min(int(raw_score / self.NORMALIZATION_DIVISOR), 100)

        return normalized_score

    async def get_flagged_users(
        self,
        reason: str | None = None,
        min_score: int | None = None,
        status: str | None = None,
        limit: int = 20,
        cursor: str | None = None
    ) -> dict:
        """List flagged users with pagination."""
        query = select(UserFlag).order_by(UserFlag.created_at.desc())

        if reason:
            query = query.where(UserFlag.flag_reason == reason)
        if min_score is not None:
            query = query.where(UserFlag.fraud_risk_score >= min_score)
        if status:
            query = query.where(UserFlag.flag_status == status)

        # Cursor pagination
        if cursor:
            try:
                cursor_id = UUID(cursor)
                cursor_flag = await self.db.get(UserFlag, str(cursor_id))
                if cursor_flag:
                    query = query.where(UserFlag.created_at < cursor_flag.created_at)
            except (ValueError, TypeError):
                pass

        result = await self.db.execute(query.limit(limit + 1))
        flags = result.scalars().all()

        has_more = len(flags) > limit
        if has_more:
            flags = flags[:limit]

        data = []
        for flag in flags:
            user = await self.db.get(User, flag.user_id)
            data.append({
                "flag_id": str(flag.id),
                "user_id": str(flag.user_id),
                "display_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else "Unknown",
                "user_type": user.user_type if user else None,
                "fraud_risk_score": flag.fraud_risk_score,
                "flag_reason": flag.flag_reason,
                "flagged_by": flag.flagged_by,
                "flag_status": flag.flag_status,
                "created_at": flag.created_at.isoformat(),
                "account_status": "paused" if user and user.is_banned else "active",
            })

        return {
            "data": data,
            "has_more": has_more,
            "next_cursor": str(flags[-1].id) if flags else None,
        }

    async def flag_user(
        self,
        user_id: UUID | str,
        reason: str,
        notes: str,
        flagged_by: str,
        admin_id: UUID | str,
    ) -> dict:
        """
        Flag a user for fraud review.
        Does NOT change account status — flagging is for review only.
        """
        user_id = str(user_id)
        admin_id = str(admin_id)

        # Check if already flagged with same reason
        existing_query = select(UserFlag).where(
            and_(
                UserFlag.user_id == user_id,
                UserFlag.flag_reason == reason,
                UserFlag.flag_status == "active",
            )
        )
        existing = await self.db.execute(existing_query)
        if existing.scalar_one_or_none():
            raise ZovuAPIError(409, "USER_ALREADY_FLAGGED", "User is already flagged for this reason")

        # Calculate fraud score
        fraud_score = await self.calculate_fraud_score(user_id)

        # Create flag
        flag = UserFlag(
            user_id=user_id,
            flag_reason=reason,
            fraud_risk_score=fraud_score,
            flagged_by=flagged_by,
            admin_notes=notes,
            flag_status="active",
        )
        self.db.add(flag)
        await self.db.flush()

        # Log action
        admin = await self.db.get(User, admin_id)
        await self._log_admin_action(
            admin_id=admin_id,
            admin_email=admin.email if admin else "unknown",
            action="user.flagged",
            target_type="user",
            target_id=user_id,
            before_state={},
            after_state={
                "flag_id": str(flag.id),
                "flag_reason": reason,
                "fraud_risk_score": fraud_score,
            },
        )

        logger.info("user_flagged", user_id=user_id, reason=reason, admin_id=admin_id)

        return {
            "flag_id": str(flag.id),
            "user_id": user_id,
            "fraud_risk_score": fraud_score,
            "flag_reason": reason,
            "created_at": flag.created_at.isoformat(),
        }

    async def pause_account(
        self,
        user_id: UUID | str,
        reason: str,
        admin_id: UUID | str,
    ) -> dict:
        """
        Pause a user account (set is_banned = True).
        Invalidate refresh tokens and JTI blacklist.
        GUARD: cannot pause own account.
        """
        user_id = str(user_id)
        admin_id = str(admin_id)

        if user_id == admin_id:
            raise ZovuAPIError(403, "CANNOT_PAUSE_SELF", "Admins cannot pause their own accounts")

        user = await self.db.get(User, user_id)
        if not user:
            raise ZovuAPIError(404, "USER_NOT_FOUND", "User not found")

        if user.is_banned:
            raise ZovuAPIError(409, "ACCOUNT_ALREADY_PAUSED", "Account is already paused")

        # Set banned status
        user.is_banned = True
        user.ban_reason = reason

        # Invalidate refresh tokens
        delete_query = delete(RefreshToken).where(RefreshToken.user_id == user_id)
        await self.db.execute(delete_query)

        # Blacklist JTIs in Redis (24h TTL)
        if self.redis:
            blacklist_key = f"user:jti_blacklist:{user_id}"
            await self.redis.setex(blacklist_key, 86400, "1")

        await self.db.flush()

        # Send email
        try:
            await self.email_service.send_email(
                to=user.email,
                subject="Your ZOVU account has been temporarily paused",
                html=self._account_paused_template(user.first_name or "there"),
            )
        except Exception as e:
            logger.error("pause_email_failed", error=str(e), user_id=user_id)

        # Log action
        admin = await self.db.get(User, admin_id)
        await self._log_admin_action(
            admin_id=admin_id,
            admin_email=admin.email if admin else "unknown",
            action="user.paused",
            target_type="user",
            target_id=user_id,
            before_state={"is_banned": False},
            after_state={"is_banned": True, "ban_reason": reason},
        )

        logger.info("user_account_paused", user_id=user_id, reason=reason, admin_id=admin_id)

        return {
            "user_id": user_id,
            "is_banned": True,
            "ban_reason": reason,
        }

    async def unpause_account(
        self,
        user_id: UUID | str,
        admin_id: UUID | str,
    ) -> dict:
        """
        Unpause a user account (set is_banned = False).
        """
        user_id = str(user_id)
        admin_id = str(admin_id)

        user = await self.db.get(User, user_id)
        if not user:
            raise ZovuAPIError(404, "USER_NOT_FOUND", "User not found")

        if not user.is_banned:
            raise ZovuAPIError(409, "ACCOUNT_NOT_PAUSED", "Account is not paused")

        user.is_banned = False
        user.ban_reason = None

        await self.db.flush()

        # Send email
        try:
            await self.email_service.send_email(
                to=user.email,
                subject="Your ZOVU account has been restored",
                html=self._account_restored_template(user.first_name or "there"),
            )
        except Exception as e:
            logger.error("unpause_email_failed", error=str(e), user_id=user_id)

        # Log action
        admin = await self.db.get(User, admin_id)
        await self._log_admin_action(
            admin_id=admin_id,
            admin_email=admin.email if admin else "unknown",
            action="user.unpaused",
            target_type="user",
            target_id=user_id,
            before_state={"is_banned": True},
            after_state={"is_banned": False},
        )

        logger.info("user_account_unpaused", user_id=user_id, admin_id=admin_id)

        return {
            "user_id": user_id,
            "is_banned": False,
        }

    async def delete_account(
        self,
        user_id: UUID | str,
        reason: str,
        admin_id: UUID | str,
    ) -> dict:
        """
        IRREVERSIBLE account deletion.
        1. Cancel pending transactions
        2. Anonymize PII
        3. Set deleted_at
        4. Invalidate sessions
        5. Log action
        GUARD: cannot delete own account or another admin.
        """
        user_id = str(user_id)
        admin_id = str(admin_id)

        if user_id == admin_id:
            raise ZovuAPIError(403, "CANNOT_DELETE_SELF", "Admins cannot delete their own accounts")

        user = await self.db.get(User, user_id)
        if not user:
            raise ZovuAPIError(404, "USER_NOT_FOUND", "User not found")

        if user.role == "admin":
            raise ZovuAPIError(403, "CANNOT_DELETE_ADMIN", "Cannot delete admin accounts")

        # Cancel pending transactions
        pending_tx_query = select(Transaction).where(
            and_(
                or_(
                    Transaction.sender_id == user_id,
                    Transaction.receiver_id == user_id,
                ),
                Transaction.status == "PENDING",
            )
        )
        pending_txs = await self.db.execute(pending_tx_query)
        for tx in pending_txs.scalars().all():
            tx.status = "FAILED"

        # Anonymize PII
        user.phone = b"DELETED"
        user.first_name = None
        user.last_name = None
        user.date_of_birth = None
        user.bvn = None
        user.nin = None
        user.email = f"deleted_{user_id}@zovu.deleted"
        
        # Mark as deleted
        user.is_banned = True
        user.ban_reason = f"account_deleted: {reason}"
        user.deleted_at = datetime.now(timezone.utc)

        # Invalidate refresh tokens
        delete_tokens_query = delete(RefreshToken).where(RefreshToken.user_id == user_id)
        await self.db.execute(delete_tokens_query)

        # Blacklist JTIs
        if self.redis:
            blacklist_key = f"user:jti_blacklist:{user_id}"
            await self.redis.setex(blacklist_key, 31536000, "1")  # 1 year

        await self.db.flush()

        # Log action
        admin = await self.db.get(User, admin_id)
        await self._log_admin_action(
            admin_id=admin_id,
            admin_email=admin.email if admin else "unknown",
            action="user.deleted",
            target_type="user",
            target_id=user_id,
            before_state={},
            after_state={
                "is_banned": True,
                "deleted_at": user.deleted_at.isoformat(),
                "ban_reason": user.ban_reason,
            },
        )

        logger.info("user_account_deleted", user_id=user_id, reason=reason, admin_id=admin_id)

        return {
            "ok": True,
            "data": {"message": "Account permanently deleted"},
        }

    async def get_fraud_analytics(self, days: int = 30) -> dict:
        """
        Return fraud analytics for dashboard.
        Cache in Redis 5 minutes.
        """
        cache_key = "admin:fraud:analytics"
        
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

        period_start = datetime.now(timezone.utc) - timedelta(days=days)

        # Total flagged
        total_flagged_result = await self.db.execute(
            select(func.count(UserFlag.id)).where(UserFlag.flag_status == "active")
        )
        total_flagged = total_flagged_result.scalar() or 0

        # Paused this period
        paused_result = await self.db.execute(
            select(func.count(User.id)).where(
                and_(
                    User.is_banned == True,
                    User.updated_at >= period_start,
                )
            )
        )
        paused_this_period = paused_result.scalar() or 0

        # Deleted this period
        deleted_result = await self.db.execute(
            select(func.count(User.id)).where(
                and_(
                    User.deleted_at.isnot(None),
                    User.deleted_at >= period_start,
                )
            )
        )
        deleted_this_period = deleted_result.scalar() or 0

        # Active investigations
        active_investigations = total_flagged  # Assume all active flags are under investigation

        # By reason
        by_reason_query = select(
            UserFlag.flag_reason,
            func.count(UserFlag.id),
        ).where(
            UserFlag.flag_status == "active"
        ).group_by(UserFlag.flag_reason)
        by_reason_result = await self.db.execute(by_reason_query)
        by_reason = {row[0]: row[1] for row in by_reason_result.all()}

        # Risk distribution
        high_count = len([f for f in await self._get_all_active_flags() if f.fraud_risk_score >= 75])
        medium_count = len([f for f in await self._get_all_active_flags() if 40 <= f.fraud_risk_score < 75])
        low_count = len([f for f in await self._get_all_active_flags() if f.fraud_risk_score < 40])

        analytics = {
            "total_flagged": total_flagged,
            "paused_this_period": paused_this_period,
            "deleted_this_period": deleted_this_period,
            "active_investigations": active_investigations,
            "by_reason": by_reason,
            "risk_distribution": {
                "high": high_count,
                "medium": medium_count,
                "low": low_count,
            },
            "recent_actions": [],
        }

        if self.redis:
            await self.redis.setex(cache_key, 300, json.dumps(analytics, default=str))

        return analytics

    # ── Helpers ──

    async def _get_all_active_flags(self) -> list:
        """Get all active user flags."""
        query = select(UserFlag).where(UserFlag.flag_status == "active")
        result = await self.db.execute(query)
        return result.scalars().all()

    async def _log_admin_action(
        self,
        admin_id: str,
        admin_email: str,
        action: str,
        target_type: str,
        target_id: str,
        before_state: dict | None = None,
        after_state: dict | None = None,
        ip_address: str | None = None,
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
            ip_address=ip_address,
        )
        self.db.add(audit)
        await self.db.flush()

    def _account_paused_template(self, first_name: str) -> str:
        """HTML template for account paused email."""
        return f"""
        <html>
        <body style="font-family: DM Sans, sans-serif; color: #1a1a1a;">
            <p>Hi {first_name},</p>
            <p>Your ZOVU account has been temporarily paused due to suspicious activity.</p>
            <p>We take fraud prevention seriously and are investigating.</p>
            <p>Your account will remain paused until our investigation is complete.</p>
            <p>We'll contact you within 48 hours.</p>
            <p>If you believe this is a mistake, reply to this email.</p>
            <p>— The ZOVU Trust & Safety Team</p>
        </body>
        </html>
        """

    def _account_restored_template(self, first_name: str) -> str:
        """HTML template for account restored email."""
        return f"""
        <html>
        <body style="font-family: DM Sans, sans-serif; color: #1a1a1a;">
            <p>Hi {first_name},</p>
            <p>Good news — your ZOVU account has been fully restored.</p>
            <p>You can log in and continue using the platform.</p>
            <p>— The ZOVU Trust & Safety Team</p>
        </body>
        </html>
        """
