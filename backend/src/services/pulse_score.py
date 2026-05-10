"""
Pulse Score service — 6-signal credit scoring algorithm.
Total score range: 0-850
Signals: Employment (0.20), Income (0.20), Repayment (0.25), Ajo (0.15), Referral (0.10), Fraud Risk (0.10, inverted)
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.models import User, PulseScore, Job, Loan, LoanStatus, Transaction, TransactionType, AjoMembership, Referral
from src.core.exceptions import NotFoundError
import structlog
from datetime import datetime, timezone, timedelta

logger = structlog.get_logger()


class PulseScoreService:
    """Pulse score calculation service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_pulse_score(self, user_id: str) -> dict:
        """
        Calculate pulse score based on 6 weighted signals.
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
        
        # Calculate 6 signals
        employment_signal = await self._calculate_employment_stability_signal(user_id)
        income_signal = await self._calculate_income_score_signal(user_id)
        repayment_signal = await self._calculate_repayment_history_signal(user_id)
        ajo_signal = await self._calculate_ajo_participation_signal(user_id)
        referral_signal = await self._calculate_referral_quality_signal(user_id)
        fraud_signal = await self._calculate_fraud_risk_signal(user_id)
        
        # Weights
        WEIGHTS = {
            "employment": 0.20,
            "income": 0.20,
            "repayment": 0.25,
            "ajo": 0.15,
            "referral": 0.10,
            "fraud": 0.10,  # Inverted (lower fraud = higher score)
        }
        
        # Calculate weighted contributions
        employment_contribution = employment_signal * WEIGHTS["employment"]
        income_contribution = income_signal * WEIGHTS["income"]
        repayment_contribution = repayment_signal * WEIGHTS["repayment"]
        ajo_contribution = ajo_signal * WEIGHTS["ajo"]
        referral_contribution = referral_signal * WEIGHTS["referral"]
        fraud_contribution = (100 - fraud_signal) * WEIGHTS["fraud"]  # Inverted
        
        # Total score (0-850 range)
        total_weighted = (
            employment_contribution +
            income_contribution +
            repayment_contribution +
            ajo_contribution +
            referral_contribution +
            fraud_contribution
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
