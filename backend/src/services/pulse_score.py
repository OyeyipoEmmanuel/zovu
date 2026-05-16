"""
Pulse Score service — 9-signal credit scoring algorithm.
Total score range: 0-850.

Original 6 signals (Task 1):
    employment, income, repayment, ajo, referral, fraud (inverted)
Task 6 added 3 more signals:
    punctuality, insurance_discipline, reputation

Each of the 3 new signals takes a fixed 0.05 slice of the weight budget
(0.15 total). The original six are scaled by 0.85 so the full WEIGHTS dict
still sums to exactly 1.0 — see the WEIGHTS dict below.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from src.models import (
    User,
    PulseScore,
    Job,
    Loan,
    LoanStatus,
    Transaction,
    TransactionType,
    AjoMembership,
    Referral,
    Gig,
    GigApplication,
    Review,
)
from src.core.exceptions import NotFoundError
import structlog
from datetime import datetime, timezone, timedelta

logger = structlog.get_logger()


# Weight budget = 1.0 total. New signals (punctuality/insurance/reputation)
# claim 0.05 each → 0.15. Original six are multiplied by 0.85 so the dict
# still sums to exactly 1.0.
#   0.20 * 0.85 = 0.17       (employment)
#   0.20 * 0.85 = 0.17       (income)
#   0.25 * 0.85 = 0.2125     (repayment)
#   0.15 * 0.85 = 0.1275     (ajo)
#   0.10 * 0.85 = 0.085      (referral)
#   0.10 * 0.85 = 0.085      (fraud, inverted)
#   0.05                     (punctuality)        ← new
#   0.05                     (insurance)          ← new
#   0.05                     (reputation)         ← new
#   ─────────────────────────
#   1.0 total
WEIGHTS = {
    "employment": 0.17,
    "income": 0.17,
    "repayment": 0.2125,
    "ajo": 0.1275,
    "referral": 0.085,
    "fraud": 0.085,          # Inverted (lower fraud = higher score)
    "punctuality": 0.05,     # New (Task 6)
    "insurance": 0.05,       # New (Task 6)
    "reputation": 0.05,      # New (Task 6)
}


class PulseScoreService:
    """Pulse score calculation service."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_pulse_score(self, user_id: str) -> dict:
        """
        Calculate pulse score based on 9 weighted signals.
        CRITICAL: This is an async background task — never call from request path.

        Args:
            user_id: User ID

        Returns:
            dict with total score and component breakdown

        Raises:
            NotFoundError: If user not found
        """
        logger.info("pulse_score_calculation_started", user_id=user_id)

        # Get user
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise NotFoundError("User not found")

        # Calculate 9 signals (each 0-100)
        employment_signal = await self._calculate_employment_stability_signal(user_id)
        income_signal = await self._calculate_income_score_signal(user_id)
        repayment_signal = await self._calculate_repayment_history_signal(user_id)
        ajo_signal = await self._calculate_ajo_participation_signal(user_id)
        referral_signal = await self._calculate_referral_quality_signal(user_id)
        fraud_signal = await self._calculate_fraud_risk_signal(user_id)
        # New Task 6 signals — helpers return 0.0-1.0 floats per the spec,
        # multiply by 100 so they live on the same scale as the others.
        punctuality_signal = int(round(await self._calc_punctuality(user_id) * 100))
        insurance_signal = int(round(await self._calc_insurance_discipline(user_id) * 100))
        reputation_signal = int(round(await self._calc_reputation(user_id) * 100))

        # Weighted contributions (each signal × its weight)
        employment_contribution = employment_signal * WEIGHTS["employment"]
        income_contribution = income_signal * WEIGHTS["income"]
        repayment_contribution = repayment_signal * WEIGHTS["repayment"]
        ajo_contribution = ajo_signal * WEIGHTS["ajo"]
        referral_contribution = referral_signal * WEIGHTS["referral"]
        fraud_contribution = (100 - fraud_signal) * WEIGHTS["fraud"]  # Inverted
        punctuality_contribution = punctuality_signal * WEIGHTS["punctuality"]
        insurance_contribution = insurance_signal * WEIGHTS["insurance"]
        reputation_contribution = reputation_signal * WEIGHTS["reputation"]

        # Sum (0-100) then scale ×10 to 0-1000 → clamp to 0-850.
        total_weighted = (
            employment_contribution
            + income_contribution
            + repayment_contribution
            + ajo_contribution
            + referral_contribution
            + fraud_contribution
            + punctuality_contribution
            + insurance_contribution
            + reputation_contribution
        )

        total_score = int(total_weighted * 10)  # Scale to 0-850
        total_score = max(0, min(850, total_score))  # Clamp to range

        logger.info(
            "pulse_score_calculated",
            user_id=user_id,
            total_score=total_score,
            employment=employment_signal,
            income=income_signal,
            repayment=repayment_signal,
            ajo=ajo_signal,
            referral=referral_signal,
            fraud=fraud_signal,
            punctuality=punctuality_signal,
            insurance=insurance_signal,
            reputation=reputation_signal,
        )

        # Store score in database
        pulse_score_record = PulseScore(
            user_id=user_id,
            employment_stability_signal=employment_signal,
            income_score_signal=income_signal,
            repayment_history_signal=repayment_signal,
            ajo_participation_signal=ajo_signal,
            referral_quality_signal=referral_signal,
            fraud_risk_signal=fraud_signal,
            punctuality_signal=punctuality_signal,
            insurance_discipline_signal=insurance_signal,
            reputation_signal=reputation_signal,
            total_score=total_score,
            calculation_timestamp=datetime.now(timezone.utc),
        )
        self.db.add(pulse_score_record)

        # Update user's current pulse score
        user.pulse_score = total_score

        await self.db.commit()

        return {
            "total_score": total_score,
            "components": [
                {"signal": "employment_stability", "value": employment_signal, "weight": WEIGHTS["employment"]},
                {"signal": "income_score", "value": income_signal, "weight": WEIGHTS["income"]},
                {"signal": "repayment_history", "value": repayment_signal, "weight": WEIGHTS["repayment"]},
                {"signal": "ajo_participation", "value": ajo_signal, "weight": WEIGHTS["ajo"]},
                {"signal": "referral_quality", "value": referral_signal, "weight": WEIGHTS["referral"]},
                {"signal": "fraud_risk", "value": fraud_signal, "weight": WEIGHTS["fraud"], "inverted": True},
                {"signal": "punctuality", "value": punctuality_signal, "weight": WEIGHTS["punctuality"]},
                {"signal": "insurance_discipline", "value": insurance_signal, "weight": WEIGHTS["insurance"]},
                {"signal": "reputation", "value": reputation_signal, "weight": WEIGHTS["reputation"]},
            ],
        }

    async def _calculate_employment_stability_signal(self, user_id: str) -> int:
        """
        Employment Stability Signal (0-100).
        Based on job tenure, employment type, and consistency.
        """
        query = select(Job).where(Job.user_id == user_id)
        result = await self.db.execute(query)
        job = result.scalar_one_or_none()

        if not job:
            return 0  # No job = 0 score

        if not job.verified:
            return 30  # Unverified job = low score

        # Score based on employment duration
        months = job.employment_duration_months
        if months >= 24:
            return 100  # 2+ years = perfect score
        elif months >= 12:
            return 80   # 1+ year = high score
        elif months >= 6:
            return 60   # 6+ months = medium score
        elif months >= 3:
            return 40   # 3+ months = low score
        else:
            return 20   # <3 months = very low score

    async def _calculate_income_score_signal(self, user_id: str) -> int:
        """
        Income Score Signal (0-100).
        Based on monthly income amount and consistency.
        Scale: 500k NAIRA (50M KOBO) = 100 score
        """
        query = select(Job).where(Job.user_id == user_id)
        result = await self.db.execute(query)
        job = result.scalar_one_or_none()

        if not job:
            return 0  # No income = 0 score

        monthly_income = job.monthly_income  # in KOBO

        # Scale: 50M KOBO (500k NAIRA) = 100 score
        score = min(100, int((monthly_income / 5000000) * 100))

        return score

    async def _calculate_repayment_history_signal(self, user_id: str) -> int:
        """
        Repayment History Signal (0-100).
        Based on on-time repayments, defaults, and total loans completed.
        """
        # Get completed loans
        query = select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == LoanStatus.COMPLETED
        )
        result = await self.db.execute(query)
        completed_loans = result.scalars().all()

        if not completed_loans:
            return 50  # No history = medium score (not yet proven)

        # Get defaulted loans
        query = select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == LoanStatus.DEFAULTED
        )
        result = await self.db.execute(query)
        defaulted_loans = result.scalars().all()

        total_loans = len(completed_loans) + len(defaulted_loans)
        repayment_rate = len(completed_loans) / total_loans if total_loans > 0 else 0

        # Score based on repayment rate
        score = int(repayment_rate * 100)

        # Bonus for multiple completed loans
        if len(completed_loans) >= 5:
            score = min(100, score + 10)

        return score

    async def _calculate_ajo_participation_signal(self, user_id: str) -> int:
        """
        Ajo Participation Signal (0-100).
        Based on number of active ajo groups and contribution consistency.
        """
        # Get ajo memberships
        query = select(AjoMembership).where(AjoMembership.user_id == user_id)
        result = await self.db.execute(query)
        memberships = result.scalars().all()

        if not memberships:
            return 0  # No ajo participation = 0 score

        # Score: 1 group = 30, 2 groups = 60, 3+ groups = 100
        if len(memberships) >= 3:
            return 100
        elif len(memberships) == 2:
            return 60
        else:
            return 30

    async def _calculate_referral_quality_signal(self, user_id: str) -> int:
        """
        Referral Quality Signal (0-100).
        Based on number of successful referrals.
        """
        # Get successful referrals made by user
        query = select(Referral).where(
            Referral.referrer_id == user_id,
            Referral.status == "completed"
        )
        result = await self.db.execute(query)
        referrals = result.scalars().all()

        if not referrals:
            return 0  # No referrals = 0 score

        # Score: 1 ref = 25, 2 refs = 50, 3 refs = 75, 4+ refs = 100
        score = min(100, len(referrals) * 25)

        return score

    async def _calculate_fraud_risk_signal(self, user_id: str) -> int:
        """
        Fraud Risk Signal (0-100).
        INVERTED: Higher value = higher risk = will subtract from total.
        Based on compliance flags, device anomalies, transaction patterns.

        For now, simplified to:
        - No flags = 0 (no risk)
        - Has flags = 50-100 (high risk)
        """
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            return 0

        if not user.compliance_flags:
            return 0  # No flags = no fraud risk

        # Risk score based on number and severity of flags
        num_flags = len(user.compliance_flags)

        if num_flags >= 3:
            return 100  # Multiple flags = max risk
        elif num_flags == 2:
            return 50   # 2 flags = medium risk
        else:
            return 25   # 1 flag = low risk

    # ─── Task 6: extended signals ────────────────────────────────────────────

    async def _calc_punctuality(self, user_id: str) -> float:
        """
        Punctuality signal (0.0-1.0).

        For each completed gig (escrow status `trader_confirmed`) in the last
        90 days where the gig had a `scheduled_at`:
          - paid before/on schedule  → 1.0
          - up to 2 hours late       → 0.5
          - more than 2 hours late   → 0.0

        Average across all qualifying gigs. No history → neutral 0.5.

        We use `Transaction.created_at` on the gig_payout transaction
        (tx_metadata.purpose == "trader_to_seeker_payout") as the actual
        "paid_at" — that row is created when the payout fires on
        trader_confirmed, so it reflects when the seeker was effectively paid.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        # Pull the seeker's confirmed applications joined to their gig so we
        # have both `scheduled_at` (the trader's expected start time) and the
        # application id (to match against tx_metadata.application_id).
        q = (
            select(GigApplication, Gig)
            .join(Gig, Gig.id == GigApplication.gig_id)
            .where(
                GigApplication.seeker_id == user_id,
                GigApplication.status == "trader_confirmed",
                GigApplication.updated_at >= cutoff,
                Gig.scheduled_at.isnot(None),
            )
        )
        rows = (await self.db.execute(q)).all()

        if not rows:
            return 0.5  # No completed jobs → neutral

        scores: list[float] = []
        for app, gig in rows:
            # Find the payout transaction for this application.
            payout_q = (
                select(Transaction)
                .where(
                    Transaction.receiver_id == user_id,
                    Transaction.status == "completed",
                    Transaction.created_at >= cutoff,
                )
                .order_by(Transaction.created_at.asc())
            )
            payout_rows = (await self.db.execute(payout_q)).scalars().all()

            paid_at = None
            for tx in payout_rows:
                meta = tx.tx_metadata or {}
                if (
                    meta.get("purpose") == "trader_to_seeker_payout"
                    and meta.get("application_id") == app.id
                ):
                    paid_at = tx.created_at
                    break

            if paid_at is None:
                # Confirmed but no payout transaction found — skip.
                continue

            scheduled_at = gig.scheduled_at
            # Normalise tz: SQLite may strip tzinfo on a `DateTime(timezone=True)` column.
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
            if paid_at.tzinfo is None:
                paid_at = paid_at.replace(tzinfo=timezone.utc)

            delta = paid_at - scheduled_at
            if delta <= timedelta(0):
                scores.append(1.0)
            elif delta <= timedelta(hours=2):
                scores.append(0.5)
            else:
                scores.append(0.0)

        if not scores:
            return 0.5

        return sum(scores) / len(scores)

    async def _calc_insurance_discipline(self, user_id: str) -> float:
        """
        Insurance discipline (0.0-1.0).

        Counts insurance (Shield) recurring payments in the last 90 days.
        Adaptation note: there is no formal "insurance product / recurring
        debit" model wired up yet, so we tag-detect against transactions:
        a row is considered an insurance premium when its
        `tx_metadata.product_type == "insurance"` OR
        `tx_metadata.category` is one of {"shield_premium",
        "accident_cover_premium", "health_insurance_premium"} — matching the
        seeder's category names so backfilled data scores meaningfully.

        success_rate = completed / total_attempts (any status in window).
        No insurance rows at all → 0.5 (neutral; don't penalise).
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        insurance_categories = (
            "shield_premium",
            "accident_cover_premium",
            "health_insurance_premium",
        )

        # All insurance-tagged attempts in window (any status).
        all_q = (
            select(Transaction)
            .where(
                or_(
                    Transaction.sender_id == user_id,
                    Transaction.receiver_id == user_id,
                ),
                Transaction.created_at >= cutoff,
                Transaction.tx_metadata.isnot(None),
            )
        )
        all_rows = (await self.db.execute(all_q)).scalars().all()

        def _is_insurance(tx: Transaction) -> bool:
            meta = tx.tx_metadata or {}
            if not isinstance(meta, dict):
                return False
            if str(meta.get("product_type", "")).lower() == "insurance":
                return True
            if str(meta.get("category", "")).lower() in insurance_categories:
                return True
            return False

        insurance_rows = [tx for tx in all_rows if _is_insurance(tx)]
        if not insurance_rows:
            return 0.5  # No insurance product → neutral

        expected = len(insurance_rows)
        successful = sum(1 for tx in insurance_rows if (tx.status or "").lower() == "completed")

        if expected == 0:
            return 0.5

        return successful / expected

    async def _calc_reputation(self, user_id: str) -> float:
        """
        Reputation signal (0.0-1.0).

        Averages all reviews where the user is the reviewee. Stars are 1-5,
        rescaled to 0-1 (divide by 5). Fewer than 3 reviews → 0.5 (neutral —
        not enough data to draw a conclusion).
        """
        q = select(Review).where(Review.reviewee_id == user_id)
        reviews = (await self.db.execute(q)).scalars().all()

        if len(reviews) < 3:
            return 0.5  # Not enough data

        average_stars = sum(r.rating for r in reviews) / len(reviews)
        return float(average_stars) / 5.0
