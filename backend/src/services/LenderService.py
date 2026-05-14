"""
LenderService — business logic for lender-facing operations.
"""
import uuid
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from src.models.base import User, Loan, LoanStatus, LenderUnlock, Credit, UserType
from src.core.utils import mask_account_number, display_name, get_pulse_tier

logger = structlog.get_logger()

INTEREST_RATE_CAP = 0.36  # 36% annual cap enforced server-side


class LenderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Stats ────────────────────────────────────────────────────────────────

    async def get_stats(self, lender: User) -> dict:
        """Aggregate lending statistics for the lender."""
        _require_lender(lender)

        loans_q = select(Loan).where(Loan.lender_id == lender.id)
        loans = (await self.db.execute(loans_q)).scalars().all()

        total_disbursed = sum(l.amount for l in loans)
        active_loans = sum(1 for l in loans if l.status == LoanStatus.ACTIVE)
        recovered = sum(l.amount_repaid or 0 for l in loans if l.status == LoanStatus.REPAID)
        overdue_count = sum(1 for l in loans if l.status == LoanStatus.OVERDUE)

        return {
            "total_disbursed": total_disbursed,
            "total_disbursed_display": f"₦{total_disbursed / 100:,.0f}",
            "active_loans": active_loans,
            "recovered": recovered,
            "recovered_display": f"₦{recovered / 100:,.0f}",
            "overdue_count": overdue_count,
            "total_loans": len(loans),
        }

    # ── Customers (anonymised borrowers) ─────────────────────────────────────

    async def get_customers(self, lender: User, filters: dict | None = None) -> list[dict]:
        """Return anonymised borrower list. Unlocked borrowers get full name."""
        _require_lender(lender)
        filters = filters or {}

        q = (
            select(User, Credit)
            .join(Credit, Credit.user_id == User.id, isouter=True)
            .where(
                or_(User.user_type == UserType.SEEKER, User.user_type == UserType.TRADER)
            )
        )

        if filters.get("min_score"):
            q = q.where(Credit.pulse_score >= int(filters["min_score"]))
        if filters.get("tier"):
            q = q.where(Credit.tier == filters["tier"])
        if filters.get("lga"):
            q = q.where(User.location.ilike(f"%{filters['lga']}%"))

        limit = min(int(filters.get("limit", 50)), 100)
        q = q.limit(limit)

        rows = (await self.db.execute(q)).all()

        unlocked_ids = await self._get_unlocked_ids(lender.id)

        result = []
        for user, credit in rows:
            score = credit.pulse_score if credit else 0
            tier = get_pulse_tier(score)
            is_unlocked = user.id in unlocked_ids

            result.append({
                "id": user.id,
                "display_name": (
                    f"{user.first_name or ''} {user.last_name or ''}".strip()
                    if is_unlocked
                    else display_name(user.first_name or "User", user.last_name or "")
                ),
                "masked_account": mask_account_number(user.squad_account_number or ""),
                "pulse_score": score,
                "tier": tier,
                "location": user.location or "",
                "is_unlocked": is_unlocked,
                "loan_amount_requested": 0,
            })

        return result

    async def unlock_customer(self, lender: User, borrower_id: str) -> dict:
        """Log a profile unlock so full name is revealed in future queries."""
        _require_lender(lender)

        borrower_q = select(User).where(User.id == borrower_id)
        borrower = (await self.db.execute(borrower_q)).scalar_one_or_none()
        if not borrower:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=404, code="USER_NOT_FOUND", message="Borrower not found")

        existing_q = select(LenderUnlock).where(
            and_(LenderUnlock.lender_id == lender.id, LenderUnlock.borrower_id == borrower_id)
        )
        if not (await self.db.execute(existing_q)).scalar_one_or_none():
            unlock = LenderUnlock(
                id=str(uuid.uuid4()),
                lender_id=lender.id,
                borrower_id=borrower_id,
            )
            self.db.add(unlock)
            await self.db.flush()

        return {
            "id": borrower.id,
            "first_name": borrower.first_name,
            "last_name": borrower.last_name,
            "email": borrower.email,
            "squad_account_number": borrower.squad_account_number,
        }

    async def get_customer_by_id(self, lender: User, borrower_id: str) -> dict:
        """Get full borrower profile if unlocked, otherwise anonymised."""
        _require_lender(lender)
        borrower_q = select(User, Credit).join(
            Credit, Credit.user_id == User.id, isouter=True
        ).where(User.id == borrower_id)
        row = (await self.db.execute(borrower_q)).one_or_none()
        if not row:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=404, code="USER_NOT_FOUND", message="Borrower not found")

        user, credit = row
        unlocked_ids = await self._get_unlocked_ids(lender.id)
        is_unlocked = user.id in unlocked_ids
        score = credit.pulse_score if credit else 0

        return {
            "id": user.id,
            "display_name": (
                f"{user.first_name or ''} {user.last_name or ''}".strip()
                if is_unlocked
                else display_name(user.first_name or "User", user.last_name or "")
            ),
            "masked_account": mask_account_number(user.squad_account_number or ""),
            "email": user.email if is_unlocked else None,
            "pulse_score": score,
            "tier": get_pulse_tier(score),
            "location": user.location or "",
            "is_unlocked": is_unlocked,
        }

    # ── Loans ────────────────────────────────────────────────────────────────

    async def get_my_loans(self, lender: User, status_filter: str | None = None) -> list[dict]:
        """All loans disbursed by this lender."""
        _require_lender(lender)
        q = select(Loan, User).join(User, User.id == Loan.borrower_id).where(
            Loan.lender_id == lender.id
        )
        if status_filter:
            q = q.where(Loan.status == status_filter)
        q = q.order_by(Loan.disbursed_at.desc())
        rows = (await self.db.execute(q)).all()

        result = []
        for loan, borrower in rows:
            result.append({
                "id": loan.id,
                "borrower_name": display_name(borrower.first_name or "User", borrower.last_name or ""),
                "amount": loan.amount,
                "amount_display": f"₦{loan.amount / 100:,.0f}",
                "disbursed_at": loan.disbursed_at.isoformat() if loan.disbursed_at else None,
                "repayment_days": loan.repayment_days,
                "due_date": loan.due_date.isoformat() if loan.due_date else None,
                "amount_repaid": loan.amount_repaid or 0,
                "total_repayment": loan.total_repayment or loan.amount,
                "status": loan.status,
                "transaction_ref": loan.transaction_ref or "",
            })
        return result

    async def get_loan_stats(self, lender: User) -> dict:
        _require_lender(lender)
        loans_q = select(Loan).where(Loan.lender_id == lender.id)
        loans = (await self.db.execute(loans_q)).scalars().all()
        total_disbursed = sum(l.amount for l in loans)
        active = sum(1 for l in loans if l.status == LoanStatus.ACTIVE)
        recovered = sum(l.amount_repaid or 0 for l in loans if l.status == LoanStatus.REPAID)
        return {
            "total_disbursed": total_disbursed,
            "active_loans": active,
            "recovered": recovered,
        }

    async def get_performance(self, lender: User) -> dict:
        """Return 30-day repayment performance metrics."""
        _require_lender(lender)
        loans_q = select(Loan).where(Loan.lender_id == lender.id)
        loans = (await self.db.execute(loans_q)).scalars().all()

        total = len(loans)
        repaid = sum(1 for l in loans if l.status == LoanStatus.REPAID)
        overdue = sum(1 for l in loans if l.status == LoanStatus.OVERDUE)
        repayment_rate = round(repaid / total * 100, 1) if total else 0.0

        return {
            "total_loans": total,
            "repaid": repaid,
            "overdue": overdue,
            "repayment_rate": repayment_rate,
        }

    # ── Internal ─────────────────────────────────────────────────────────────

    async def _get_unlocked_ids(self, lender_id: str) -> set[str]:
        q = select(LenderUnlock.borrower_id).where(LenderUnlock.lender_id == lender_id)
        rows = (await self.db.execute(q)).all()
        return {r[0] for r in rows}


# ── Role helper ──────────────────────────────────────────────────────────────

def _require_lender(user: User) -> None:
    if (user.role or "").lower() not in ("lender", "both"):
        from src.core.exceptions import ZovuAPIError
        raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="Lender role required")
