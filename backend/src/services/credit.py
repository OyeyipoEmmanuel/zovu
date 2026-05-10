"""
Credit service — manage credit accounts and available balances.
Credit limits are determined by pulse score.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models import User, Credit, Loan, LoanStatus
from src.core.exceptions import NotFoundError, ValidationError
import structlog
from datetime import datetime, timezone

logger = structlog.get_logger()

# Credit limit tiers based on pulse score
CREDIT_TIERS = {
    0: 50000,      # 500 naira
    100: 100000,   # 1,000 naira
    200: 250000,   # 2,500 naira
    300: 500000,   # 5,000 naira
    400: 1000000,  # 10,000 naira
    500: 2000000,  # 20,000 naira
    600: 5000000,  # 50,000 naira
    700: 10000000, # 100,000 naira
    800: 20000000, # 200,000 naira
    850: 50000000, # 500,000 naira
}


class CreditService:
    """Credit account management service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_or_create_credit_account(self, user_id: str) -> Credit:
        """
        Get or create credit account for user.
        
        Args:
            user_id: User ID
            
        Returns:
            Credit object
        """
        logger.info("credit_account_lookup", user_id=user_id)
        
        # Check if user exists
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            logger.error("user_not_found", user_id=user_id)
            raise NotFoundError("User not found")
        
        # Get credit account
        query = select(Credit).where(Credit.user_id == user_id)
        result = await self.db.execute(query)
        credit = result.scalar_one_or_none()
        
        if not credit:
            # Create new credit account
            credit = Credit(
                user_id=user_id,
                available_balance=0,
                reserved_balance=0,
                status="active",
            )
            self.db.add(credit)
            await self.db.commit()
            logger.info("credit_account_created", user_id=user_id)
        
        return credit
    
    async def get_credit_status(self, user_id: str) -> dict:
        """
        Get credit account status with max eligible loan.
        
        Args:
            user_id: User ID
            
        Returns:
            dict with balances and max eligible loan
        """
        logger.info("credit_status_requested", user_id=user_id)
        
        # Get user with pulse score
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError("User not found")
        
        # Get credit account
        credit = await self.get_or_create_credit_account(user_id)
        
        # Calculate max eligible loan based on pulse score
        max_eligible = self._calculate_max_eligible_loan(user.pulse_score)
        
        return {
            "available_balance": credit.available_balance,
            "reserved_balance": credit.reserved_balance,
            "total_balance": credit.available_balance + credit.reserved_balance,
            "max_eligible_loan": max_eligible,
            "status": credit.status,
        }
    
    async def deposit_credit(self, user_id: str, amount: int) -> dict:
        """
        Deposit credit to account (from Squad transfers).
        Amount in KOBO.
        
        Args:
            user_id: User ID
            amount: Amount in KOBO (integer)
            
        Returns:
            dict with updated balance
            
        Raises:
            ValidationError: If amount invalid
        """
        if amount <= 0:
            raise ValidationError("Amount must be positive")
        
        logger.info("credit_deposit_started", user_id=user_id, amount=amount)
        
        credit = await self.get_or_create_credit_account(user_id)
        credit.available_balance += amount
        
        await self.db.commit()
        logger.info("credit_deposited", user_id=user_id, amount=amount, new_balance=credit.available_balance)
        
        return {
            "available_balance": credit.available_balance,
            "total_balance": credit.available_balance + credit.reserved_balance,
        }
    
    async def withdraw_credit(self, user_id: str, amount: int) -> dict:
        """
        Withdraw credit from account.
        Amount in KOBO.
        
        Args:
            user_id: User ID
            amount: Amount in KOBO
            
        Returns:
            dict with updated balance
            
        Raises:
            ValidationError: If insufficient funds
        """
        if amount <= 0:
            raise ValidationError("Amount must be positive")
        
        logger.info("credit_withdrawal_started", user_id=user_id, amount=amount)
        
        credit = await self.get_or_create_credit_account(user_id)
        
        if credit.available_balance < amount:
            logger.warning("insufficient_credit", user_id=user_id, available=credit.available_balance, requested=amount)
            raise ValidationError("Insufficient credit balance")
        
        credit.available_balance -= amount
        credit.total_withdrawn += amount
        
        await self.db.commit()
        logger.info("credit_withdrawn", user_id=user_id, amount=amount, new_balance=credit.available_balance)
        
        return {
            "available_balance": credit.available_balance,
            "total_balance": credit.available_balance + credit.reserved_balance,
        }
    
    async def reserve_credit_for_loan(self, user_id: str, amount: int) -> dict:
        """
        Reserve credit for pending loan (moves from available to reserved).
        Amount in KOBO.
        
        Args:
            user_id: User ID
            amount: Amount to reserve in KOBO
            
        Returns:
            dict with updated balances
            
        Raises:
            ValidationError: If insufficient available balance
        """
        if amount <= 0:
            raise ValidationError("Amount must be positive")
        
        logger.info("credit_reservation_started", user_id=user_id, amount=amount)
        
        credit = await self.get_or_create_credit_account(user_id)
        
        if credit.available_balance < amount:
            raise ValidationError("Insufficient available credit")
        
        credit.available_balance -= amount
        credit.reserved_balance += amount
        
        await self.db.commit()
        logger.info("credit_reserved", user_id=user_id, amount=amount)
        
        return {
            "available_balance": credit.available_balance,
            "reserved_balance": credit.reserved_balance,
            "total_balance": credit.available_balance + credit.reserved_balance,
        }
    
    async def release_reserved_credit(self, user_id: str, amount: int) -> dict:
        """
        Release reserved credit (loan rejected or cancelled).
        
        Args:
            user_id: User ID
            amount: Amount to release in KOBO
            
        Returns:
            dict with updated balances
        """
        if amount <= 0:
            raise ValidationError("Amount must be positive")
        
        logger.info("credit_release_started", user_id=user_id, amount=amount)
        
        credit = await self.get_or_create_credit_account(user_id)
        
        if credit.reserved_balance < amount:
            logger.warning("reserved_balance_insufficient", user_id=user_id)
            raise ValidationError("Insufficient reserved credit")
        
        credit.reserved_balance -= amount
        credit.available_balance += amount
        
        await self.db.commit()
        logger.info("credit_released", user_id=user_id, amount=amount)
        
        return {
            "available_balance": credit.available_balance,
            "reserved_balance": credit.reserved_balance,
            "total_balance": credit.available_balance + credit.reserved_balance,
        }
    
    def _calculate_max_eligible_loan(self, pulse_score: int) -> int:
        """
        Calculate max eligible loan based on pulse score.
        Uses tiered approach: higher score = larger max loan.
        
        Args:
            pulse_score: User pulse score (0-850)
            
        Returns:
            Max eligible loan in KOBO
        """
        # Find applicable tier
        for threshold in sorted(CREDIT_TIERS.keys(), reverse=True):
            if pulse_score >= threshold:
                return CREDIT_TIERS[threshold]
        
        return 0
    
    async def check_eligibility(self, user_id: str, requested_amount: int) -> dict:
        """
        Check if user is eligible for requested loan amount.
        
        Args:
            user_id: User ID
            requested_amount: Requested amount in KOBO
            
        Returns:
            dict with eligibility status and reasons
        """
        logger.info("eligibility_check", user_id=user_id, amount=requested_amount)
        
        # Get user
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError("User not found")
        
        # Get credit account
        credit = await self.get_or_create_credit_account(user_id)
        
        # Check if user is frozen
        if user.status == "frozen":
            return {
                "eligible": False,
                "reason": "Account is frozen",
                "max_eligible": 0,
            }
        
        # Check if KYC verified
        if not user.kyc_verified:
            return {
                "eligible": False,
                "reason": "KYC not verified",
                "max_eligible": 0,
            }
        
        # Get max eligible based on pulse score
        max_eligible = self._calculate_max_eligible_loan(user.pulse_score)
        
        # Check against requested amount
        if requested_amount > max_eligible:
            return {
                "eligible": False,
                "reason": "Requested amount exceeds max eligible",
                "max_eligible": max_eligible,
                "requested": requested_amount,
            }
        
        # Check for existing active loans
        query = select(Loan).where(
            Loan.user_id == user_id,
            Loan.status.in_([LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.REPAYING])
        )
        result = await self.db.execute(query)
        active_loans = result.scalars().all()
        
        if len(active_loans) > 0:
            return {
                "eligible": False,
                "reason": "User has active loans",
                "max_eligible": max_eligible,
            }
        
        logger.info("eligibility_approved", user_id=user_id, amount=requested_amount)
        
        return {
            "eligible": True,
            "reason": "Approved",
            "max_eligible": max_eligible,
        }
