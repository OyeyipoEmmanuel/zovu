"""
LenderService — business logic for lender-facing operations.

The Loan model has only a single `user_id` foreign key (the borrower); there is
no `lender_id` column yet, so any "loans I disbursed" query is scoped to the
authenticated user. That keeps the endpoint contract honest (no AttributeError)
until a true lender↔borrower relationship is introduced.
"""
import uuid
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from src.models.base import User, Loan, LoanStatus, LenderUnlock, UserType
from src.core.utils import mask_account_number, display_name, get_pulse_tier

logger = structlog.get_logger()

INTEREST_RATE_CAP = 0.36  # 36% annual cap enforced server-side

# Aliases mapping the conceptual "active / repaid / overdue" buckets the
# frontend understands onto the LoanStatus values that actually exist.
ACTIVE_STATUSES = (LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.REPAYING)
REPAID_STATUSES = (LoanStatus.COMPLETED,)
OVERDUE_STATUSES = (LoanStatus.DEFAULTED,)


def _bucket(status: LoanStatus) -> str:
    if status in REPAID_STATUSES:
        return "repaid"
    if status in OVERDUE_STATUSES:
        return "overdue"
    return "active"


class LenderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Stats ────────────────────────────────────────────────────────────────

    async def get_stats(self, lender: User) -> dict:
        """Aggregate lending statistics for the lender."""
        _require_lender(lender)

        loans_q = select(Loan).where(Loan.user_id == lender.id)
        loans = (await self.db.execute(loans_q)).scalars().all()

        total_disbursed = sum(l.principal_amount or 0 for l in loans)
        active_loans = sum(1 for l in loans if l.status in ACTIVE_STATUSES)
        recovered = sum(l.amount_repaid or 0 for l in loans if l.status in REPAID_STATUSES)
        overdue_count = sum(1 for l in loans if l.status in OVERDUE_STATUSES)

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

        q = select(User).where(
            or_(User.user_type == UserType.SEEKER, User.user_type == UserType.TRADER)
        )

        if filters.get("min_score"):
            q = q.where(User.pulse_score >= int(filters["min_score"]))
        if filters.get("lga"):
            q = q.where(User.location.ilike(f"%{filters['lga']}%"))

        limit = min(int(filters.get("limit", 50)), 100)
        q = q.limit(limit)

        users = (await self.db.execute(q)).scalars().all()

        # Tier filter is derived from pulse_score — apply in Python because
        # `tier` is not a stored column.
        tier_filter = (filters.get("tier") or "").lower() or None
        if tier_filter:
            users = [u for u in users if get_pulse_tier(int(u.pulse_score or 0)).lower() == tier_filter]

        unlocked_ids = await self._get_unlocked_ids(lender.id)

        result = []
        for user in users:
            score = int(user.pulse_score or 0)
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
                "loan_amount_requested": int(user.max_credit_limit or 0),
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
        user = (
            await self.db.execute(select(User).where(User.id == borrower_id))
        ).scalar_one_or_none()
        if not user:
            from src.core.exceptions import ZovuAPIError
            raise ZovuAPIError(status_code=404, code="USER_NOT_FOUND", message="Borrower not found")

        unlocked_ids = await self._get_unlocked_ids(lender.id)
        is_unlocked = user.id in unlocked_ids
        score = int(user.pulse_score or 0)

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
            "loan_amount_requested": int(user.max_credit_limit or 0),
        }

    # ── Loans ────────────────────────────────────────────────────────────────

    async def get_my_loans(self, lender: User, status_filter: str | None = None) -> list[dict]:
        """All loans disbursed by this lender (currently scoped by user_id)."""
        _require_lender(lender)
        q = select(Loan, User).join(User, User.id == Loan.user_id).where(
            Loan.user_id == lender.id
        )
        if status_filter:
            target_bucket = status_filter.lower()
            allowed: tuple[LoanStatus, ...]
            if target_bucket == "active":
                allowed = ACTIVE_STATUSES
            elif target_bucket == "repaid":
                allowed = REPAID_STATUSES
            elif target_bucket == "overdue":
                allowed = OVERDUE_STATUSES
            else:
                allowed = ()
            if allowed:
                q = q.where(Loan.status.in_(allowed))
        q = q.order_by(Loan.disbursal_date.desc())
        rows = (await self.db.execute(q)).all()

        result = []
        for loan, borrower in rows:
            principal = int(loan.principal_amount or 0)
            result.append({
                "id": loan.id,
                "borrower_name": display_name(borrower.first_name or "User", borrower.last_name or ""),
                "amount": principal,
                "amount_display": f"₦{principal / 100:,.0f}",
                "disbursed_at": loan.disbursal_date.isoformat() if loan.disbursal_date else None,
                "repayment_days": int(loan.tenure_days or 0),
                "due_date": loan.due_date.isoformat() if loan.due_date else None,
                "amount_repaid": int(loan.amount_repaid or 0),
                "total_repayment": int(loan.total_repayment or principal),
                "status": _bucket(loan.status),
                "transaction_ref": loan.squad_transaction_id or "",
            })
        return result

    async def get_loan_stats(self, lender: User) -> dict:
        _require_lender(lender)
        loans_q = select(Loan).where(Loan.user_id == lender.id)
        loans = (await self.db.execute(loans_q)).scalars().all()
        total_disbursed = sum(l.principal_amount or 0 for l in loans)
        active = sum(1 for l in loans if l.status in ACTIVE_STATUSES)
        recovered = sum(l.amount_repaid or 0 for l in loans if l.status in REPAID_STATUSES)
        return {
            "total_disbursed": total_disbursed,
            "active_loans": active,
            "recovered": recovered,
        }

    async def get_performance(self, lender: User) -> dict:
        """Return repayment performance metrics."""
        _require_lender(lender)
        loans_q = select(Loan).where(Loan.user_id == lender.id)
        loans = (await self.db.execute(loans_q)).scalars().all()

        total = len(loans)
        repaid = sum(1 for l in loans if l.status in REPAID_STATUSES)
        overdue = sum(1 for l in loans if l.status in OVERDUE_STATUSES)
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
