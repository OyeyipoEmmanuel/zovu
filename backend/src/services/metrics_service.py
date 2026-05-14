"""
Metrics and analytics service for admin dashboard.
Provides user, transaction, business, and partnership metrics.
"""
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from redis import Redis
from datetime import datetime, timezone, timedelta, date
import structlog
import json

from src.models.base import User, Transaction, UserType
from src.models.admin import Complaint, UserFlag, PartnershipRequest, Partnership, AdminAuditLog
from src.core.exceptions import ZovuAPIError

logger = structlog.get_logger()


class MetricsService:
    """Metrics and analytics service."""

    def __init__(self, db: AsyncSession, redis: Redis | None = None):
        self.db = db
        self.redis = redis

    async def get_overview(self) -> dict:
        """
        Get overview metrics for admin dashboard.
        Cache in Redis for 2 minutes.
        """
        cache_key = "admin:metrics:overview"
        
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

        # ── Users ──
        total_users_result = await self.db.execute(select(func.count(User.id)))
        total_users = total_users_result.scalar() or 0

        traders_result = await self.db.execute(
            select(func.count(User.id)).where(User.user_type == UserType.TRADER)
        )
        traders = traders_result.scalar() or 0

        seekers_result = await self.db.execute(
            select(func.count(User.id)).where(User.user_type == UserType.SEEKER)
        )
        seekers = seekers_result.scalar() or 0

        lenders_result = await self.db.execute(
            select(func.count(User.id)).where(User.role == "lender")
        )
        lenders = lenders_result.scalar() or 0

        today = datetime.now(timezone.utc).date()
        new_today_result = await self.db.execute(
            select(func.count(User.id)).where(
                func.cast(User.created_at, func.DATE) == today
            )
        )
        new_today = new_today_result.scalar() or 0

        this_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_this_month_result = await self.db.execute(
            select(func.count(User.id)).where(User.created_at >= this_month_start)
        )
        new_this_month = new_this_month_result.scalar() or 0

        daily_active_result = await self.db.execute(
            select(func.count(func.distinct(Transaction.sender_id))).where(
                Transaction.created_at >= datetime.now(timezone.utc) - timedelta(days=1),
                Transaction.status == "COMPLETED",
            )
        )
        daily_active = daily_active_result.scalar() or 0

        kyc_verified_result = await self.db.execute(
            select(func.count(User.id)).where(User.kyc_verified == True)
        )
        kyc_verified = kyc_verified_result.scalar() or 0

        # ── Partnerships ──
        total_partnerships_result = await self.db.execute(
            select(func.count(Partnership.id)).where(Partnership.status == "active")
        )
        total_partnerships = total_partnerships_result.scalar() or 0

        pending_partnership_requests_result = await self.db.execute(
            select(func.count(PartnershipRequest.id)).where(
                PartnershipRequest.status.in_(["pending", "under_review"])
            )
        )
        pending_partnership_requests = pending_partnership_requests_result.scalar() or 0

        # ── Transactions ──
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        volume_today_result = await self.db.execute(
            select(func.sum(Transaction.amount_gross)).where(
                and_(
                    Transaction.status == "COMPLETED",
                    Transaction.created_at >= today_start,
                    Transaction.created_at < today_end,
                )
            )
        )
        volume_today_kobo = int((volume_today_result.scalar() or 0) * 100)

        count_today_result = await self.db.execute(
            select(func.count(Transaction.id)).where(
                and_(
                    Transaction.created_at >= today_start,
                    Transaction.created_at < today_end,
                )
            )
        )
        count_today = count_today_result.scalar() or 0

        # Success rate (last 7 days)
        week_start = datetime.now(timezone.utc) - timedelta(days=7)
        success_count_result = await self.db.execute(
            select(func.count(Transaction.id)).where(
                and_(
                    Transaction.status == "COMPLETED",
                    Transaction.created_at >= week_start,
                )
            )
        )
        success_count = success_count_result.scalar() or 0

        total_tx_week_result = await self.db.execute(
            select(func.count(Transaction.id)).where(Transaction.created_at >= week_start)
        )
        total_tx_week = total_tx_week_result.scalar() or 1

        success_rate_pct = (success_count / total_tx_week * 100) if total_tx_week > 0 else 0

        avg_size_result = await self.db.execute(
            select(func.avg(Transaction.amount_gross)).where(
                and_(
                    Transaction.status == "COMPLETED",
                    Transaction.created_at >= week_start,
                )
            )
        )
        avg_size_kobo = int((avg_size_result.scalar() or 0) * 100)

        # ── Alerts ──
        new_fraud_flags_result = await self.db.execute(
            select(func.count(UserFlag.id)).where(
                and_(
                    UserFlag.created_at >= datetime.now(timezone.utc) - timedelta(days=1),
                    UserFlag.flag_status == "active",
                )
            )
        )
        new_fraud_flags = new_fraud_flags_result.scalar() or 0

        unresolved_complaints_result = await self.db.execute(
            select(func.count(Complaint.id)).where(
                Complaint.status.in_(["new", "investigating"])
            )
        )
        unresolved_complaints = unresolved_complaints_result.scalar() or 0

        overview = {
            "users": {
                "total": total_users,
                "traders": traders,
                "seekers": seekers,
                "lenders": lenders,
                "new_today": new_today,
                "new_this_month": new_this_month,
                "daily_active": daily_active,
                "kyc_verified": kyc_verified,
            },
            "partnerships": {
                "total_active": total_partnerships,
                "pending_requests": pending_partnership_requests,
            },
            "transactions": {
                "volume_today_kobo": volume_today_kobo,
                "count_today": count_today,
                "success_rate_pct": float(success_rate_pct),
                "avg_size_kobo": avg_size_kobo,
            },
            "alerts": {
                "new_fraud_flags": new_fraud_flags,
                "unresolved_complaints": unresolved_complaints,
                "pending_partnerships": pending_partnership_requests,
            }
        }

        if self.redis:
            await self.redis.setex(cache_key, 120, json.dumps(overview, default=str))

        return overview

    async def get_user_metrics(self, period_days: int = 30) -> dict:
        """Get user growth metrics over period."""
        period_start = datetime.now(timezone.utc) - timedelta(days=period_days)
        
        # Daily new users
        daily_users = {}
        for i in range(period_days):
            day = period_start + timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            count_result = await self.db.execute(
                select(func.count(User.id)).where(
                    and_(
                        User.created_at >= day_start,
                        User.created_at < day_end,
                    )
                )
            )
            daily_users[day.strftime("%Y-%m-%d")] = count_result.scalar() or 0

        # KYC verified %
        total = await self.db.execute(select(func.count(User.id)))
        total_users = total.scalar() or 1
        
        verified = await self.db.execute(
            select(func.count(User.id)).where(User.kyc_verified == True)
        )
        verified_users = verified.scalar() or 0
        kyc_verified_pct = (verified_users / total_users * 100) if total_users > 0 else 0

        # Active today %
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        active_today = await self.db.execute(
            select(func.count(func.distinct(Transaction.sender_id))).where(
                and_(
                    Transaction.created_at >= today_start,
                    Transaction.status == "COMPLETED",
                )
            )
        )
        active_today_count = active_today.scalar() or 0
        active_today_pct = (active_today_count / total_users * 100) if total_users > 0 else 0

        return {
            "daily_new_users": daily_users,
            "kyc_verified_pct": kyc_verified_pct,
            "active_today_pct": active_today_pct,
        }

    async def get_transaction_metrics(self, period_days: int = 30) -> dict:
        """Get transaction metrics over period."""
        period_start = datetime.now(timezone.utc) - timedelta(days=period_days)
        
        # Daily volume and count
        daily_volume = {}
        daily_count = {}
        daily_max = {"date": None, "volume": 0}

        for i in range(period_days):
            day = period_start + timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            volume_result = await self.db.execute(
                select(func.sum(Transaction.amount_gross)).where(
                    and_(
                        Transaction.status == "COMPLETED",
                        Transaction.created_at >= day_start,
                        Transaction.created_at < day_end,
                    )
                )
            )
            volume = volume_result.scalar() or 0
            daily_volume[day.strftime("%Y-%m-%d")] = int(volume * 100)

            count_result = await self.db.execute(
                select(func.count(Transaction.id)).where(
                    and_(
                        Transaction.created_at >= day_start,
                        Transaction.created_at < day_end,
                    )
                )
            )
            count = count_result.scalar() or 0
            daily_count[day.strftime("%Y-%m-%d")] = count

            if volume > daily_max["volume"]:
                daily_max["date"] = day.strftime("%Y-%m-%d")
                daily_max["volume"] = volume

        # Status breakdown
        status_query = select(
            Transaction.status,
            func.count(Transaction.id)
        ).where(Transaction.created_at >= period_start).group_by(Transaction.status)
        status_result = await self.db.execute(status_query)
        status_breakdown = [
            {"status": row[0], "value": row[1]} for row in status_result.all()
        ]

        return {
            "daily_volume_kobo": daily_volume,
            "daily_count": daily_count,
            "top_day": daily_max,
            "status_breakdown": status_breakdown,
        }

    async def get_business_metrics(self) -> dict:
        """Get trader breakdown metrics."""
        # By type
        wholesalers = await self.db.execute(
            select(func.count(User.id)).where(User.business_type == "wholesaler")
        )
        retailers = await self.db.execute(
            select(func.count(User.id)).where(User.business_type == "retailer")
        )
        kioskowners = await self.db.execute(
            select(func.count(User.id)).where(User.business_type == "small_kiosk")
        )
        online_vendors = await self.db.execute(
            select(func.count(User.id)).where(User.business_type == "online_vendor")
        )

        # Sector distribution
        sector_query = select(
            User.business_type,
            func.count(User.id)
        ).where(User.user_type == UserType.TRADER).group_by(User.business_type)
        sector_result = await self.db.execute(sector_query)
        sector_distribution = [
            {"sector": row[0] or "Other", "count": row[1]} for row in sector_result.all()
        ]

        return {
            "by_type": {
                "wholesaler": wholesalers.scalar() or 0,
                "retailer": retailers.scalar() or 0,
                "small_kiosk": kioskowners.scalar() or 0,
                "online_vendor": online_vendors.scalar() or 0,
            },
            "sector_distribution": sector_distribution
        }

    async def generate_daily_report(self, report_date: date) -> dict:
        """Generate daily report snapshot for a specific date."""
        cache_key = f"admin:report:daily:{report_date.isoformat()}"
        
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

        day_start = datetime.combine(report_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        # Transactions for the day
        tx_count_result = await self.db.execute(
            select(func.count(Transaction.id)).where(
                and_(
                    Transaction.created_at >= day_start,
                    Transaction.created_at < day_end,
                )
            )
        )
        tx_count = tx_count_result.scalar() or 0

        tx_volume_result = await self.db.execute(
            select(func.sum(Transaction.amount_gross)).where(
                and_(
                    Transaction.status == "COMPLETED",
                    Transaction.created_at >= day_start,
                    Transaction.created_at < day_end,
                )
            )
        )
        tx_volume_kobo = int((tx_volume_result.scalar() or 0) * 100)

        tx_success_result = await self.db.execute(
            select(func.count(Transaction.id)).where(
                and_(
                    Transaction.status == "COMPLETED",
                    Transaction.created_at >= day_start,
                    Transaction.created_at < day_end,
                )
            )
        )
        tx_success = tx_success_result.scalar() or 0

        success_rate = (tx_success / tx_count * 100) if tx_count > 0 else 0

        # New users
        new_users_result = await self.db.execute(
            select(func.count(User.id)).where(
                and_(
                    User.created_at >= day_start,
                    User.created_at < day_end,
                )
            )
        )
        new_users = new_users_result.scalar() or 0

        # Complaints
        complaints_result = await self.db.execute(
            select(func.count(Complaint.id)).where(
                and_(
                    Complaint.created_at >= day_start,
                    Complaint.created_at < day_end,
                )
            )
        )
        complaints = complaints_result.scalar() or 0

        # Fraud flags
        fraud_flags_result = await self.db.execute(
            select(func.count(UserFlag.id)).where(
                and_(
                    UserFlag.created_at >= day_start,
                    UserFlag.created_at < day_end,
                )
            )
        )
        fraud_flags = fraud_flags_result.scalar() or 0

        report = {
            "date": report_date.isoformat(),
            "transactions": {
                "total": tx_count,
                "completed": tx_success,
                "success_rate_pct": success_rate,
                "volume_kobo": tx_volume_kobo,
            },
            "users": {
                "new_signups": new_users,
            },
            "compliance": {
                "complaints_filed": complaints,
                "fraud_flags_created": fraud_flags,
            },
        }

        if self.redis:
            await self.redis.setex(cache_key, 86400, json.dumps(report, default=str))

        return report
