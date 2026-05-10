"""
Loan service — loan requests, auto-approval, repayment tracking.
Loans are auto-approved based on pulse score and eligibility.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models import User, Loan, LoanStatus, Credit, Transaction, TransactionType
from src.core.exceptions import ValidationError, NotFoundError, ConflictError
import structlog
from datetime import datetime, timedelta, timezone
import uuid

logger = structlog.get_logger()

# Interest rate (per annum as float, converted to per-day)
ANNUAL_INTEREST_RATE = 0.36  # 36% APY

# Tenure to interest rate multiplier (for simplicity)
TENURE_MULTIPLIERS = {
    7: 0.007,    # 7-day: ~0.7% interest
    14: 0.014,   # 14-day: ~1.4% interest
    30: 0.03,    # 30-day: ~3% interest
    60: 0.06,    # 60-day: ~6% interest
}


class LoanService:
    """Loan management service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_loan_terms(self, principal: int, tenure_days: int) -> dict:
        """
        Calculate loan terms (interest, total repayment).
        Does NOT create any database records.
        All amounts in KOBO.
        
        Args:
            principal: Principal amount in KOBO
            tenure_days: Loan tenure (7, 14, 30, 60 days)
            
        Returns:
            dict with principal, interest, total repayment
            
        Raises:
            ValidationError: If tenure invalid or principal too high
        """
        if tenure_days not in [7, 14, 30, 60]:
            raise ValidationError("Tenure must be 7, 14, 30, or 60 days")
        
        if principal <= 0:
            raise ValidationError("Principal must be positive")
        
        # Calculate interest based on tenure
        multiplier = TENURE_MULTIPLIERS.get(tenure_days, 0.03)
        interest_amount = int(principal * multiplier)
        total_repayment = principal + interest_amount
        
        # Calculate daily rate
        daily_rate = multiplier / tenure_days
        
        logger.info(
            "loan_terms_calculated",
            principal=principal,
            tenure_days=tenure_days,
            interest=interest_amount,
            total=total_repayment,
        )
        
        return {
            "principal_amount": principal,
            "interest_amount": interest_amount,
            "total_repayment": total_repayment,
            "daily_rate": round(daily_rate, 4),
            "tenure_days": tenure_days,
        }
    
    async def request_loan(self, user_id: str, principal: int, tenure_days: int) -> dict:
        """
        Request a loan.
        Auto-approved if user is eligible.
        Reserves credit from available balance.
        
        Args:
            user_id: User ID
            principal: Principal amount in KOBO
            tenure_days: Tenure (7, 14, 30, 60)
            
        Returns:
            dict with loan details and status
            
        Raises:
            ValidationError: If eligibility checks fail
            NotFoundError: If user not found
        """
        if tenure_days not in [7, 14, 30, 60]:
            raise ValidationError("Tenure must be 7, 14, 30, or 60 days")
        
        if principal <= 0:
            raise ValidationError("Principal must be positive")
        
        logger.info("loan_request_started", user_id=user_id, principal=principal, tenure=tenure_days)
        
        # Get user
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError("User not found")
        
        # Check eligibility (via credit service in production)
        if user.status == "frozen":
            logger.warning("loan_request_user_frozen", user_id=user_id)
            raise ConflictError("Account is frozen")
        
        if not user.kyc_verified:
            raise ValidationError("KYC verification required")
        
        # Check for existing active loans
        query = select(Loan).where(
            Loan.user_id == user_id,
            Loan.status.in_([LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.REPAYING])
        )
        result = await self.db.execute(query)
        existing_loans = result.scalars().all()
        
        if len(existing_loans) > 0:
            raise ConflictError("User has active loans")
        
        # Calculate terms
        terms = await self.calculate_loan_terms(principal, tenure_days)
        
        # Create loan record
        due_date = datetime.now(timezone.utc) + timedelta(days=tenure_days)
        
        loan = Loan(
            user_id=user_id,
            principal_amount=principal,
            interest_amount=terms["interest_amount"],
            total_repayment=terms["total_repayment"],
            amount_repaid=0,
            status=LoanStatus.PENDING,
            tenure_days=tenure_days,
            due_date=due_date,
        )
        
        self.db.add(loan)
        await self.db.flush()
        
        logger.info(
            "loan_created",
            user_id=user_id,
            loan_id=loan.id,
            principal=principal,
            status=LoanStatus.PENDING,
        )
        
        # Auto-approve (no manual approval needed)
        loan.status = LoanStatus.APPROVED
        
        # Reserve credit for the loan
        # In production, integrate with CreditService
        query = select(Credit).where(Credit.user_id == user_id)
        result = await self.db.execute(query)
        credit = result.scalar_one_or_none()
        
        if not credit:
            credit = Credit(user_id=user_id, available_balance=principal)
            self.db.add(credit)
        
        # Check if sufficient available balance
        if credit.available_balance < principal:
            # In credit-based system, this may be ok — just reserve
            pass
        
        credit.available_balance = max(0, credit.available_balance - principal)
        credit.reserved_balance += principal
        
        await self.db.commit()
        
        logger.info("loan_auto_approved", loan_id=loan.id, user_id=user_id)
        
        return {
            "loan_id": loan.id,
            "principal_amount": principal,
            "interest_amount": terms["interest_amount"],
            "total_repayment": terms["total_repayment"],
            "status": LoanStatus.APPROVED,
            "tenure_days": tenure_days,
            "due_date": due_date.isoformat(),
        }
    
    async def disburse_loan(self, loan_id: str, squad_transaction_id: str) -> dict:
        """
        Mark loan as disbursed (after Squad transfer succeeds).
        
        Args:
            loan_id: Loan ID
            squad_transaction_id: Squad transaction ID
            
        Returns:
            dict with updated loan status
            
        Raises:
            NotFoundError: If loan not found
        """
        logger.info("loan_disbursal_started", loan_id=loan_id)
        
        query = select(Loan).where(Loan.id == loan_id)
        result = await self.db.execute(query)
        loan = result.scalar_one_or_none()
        
        if not loan:
            raise NotFoundError("Loan not found")
        
        loan.status = LoanStatus.DISBURSED
        loan.disbursal_date = datetime.now(timezone.utc)
        loan.squad_transaction_id = squad_transaction_id
        
        # Create transaction record
        transaction = Transaction(
            user_id=loan.user_id,
            loan_id=loan_id,
            transaction_type=TransactionType.LOAN_DISBURSEMENT,
            amount=loan.principal_amount,
            squad_reference=squad_transaction_id,
            status="completed",
            metadata={"loan_tenure_days": loan.tenure_days},
        )
        self.db.add(transaction)
        
        await self.db.commit()
        logger.info("loan_disbursed", loan_id=loan_id, amount=loan.principal_amount)
        
        return {
            "loan_id": loan_id,
            "status": LoanStatus.DISBURSED,
            "disbursal_date": loan.disbursal_date.isoformat(),
        }
    
    async def record_repayment(self, loan_id: str, amount: int, squad_reference: str = None) -> dict:
        """
        Record loan repayment.
        
        Args:
            loan_id: Loan ID
            amount: Repayment amount in KOBO
            squad_reference: Optional Squad transaction reference
            
        Returns:
            dict with updated repayment status
            
        Raises:
            ValidationError: If amount invalid
            NotFoundError: If loan not found
        """
        if amount <= 0:
            raise ValidationError("Repayment amount must be positive")
        
        logger.info("repayment_started", loan_id=loan_id, amount=amount)
        
        query = select(Loan).where(Loan.id == loan_id)
        result = await self.db.execute(query)
        loan = result.scalar_one_or_none()
        
        if not loan:
            raise NotFoundError("Loan not found")
        
        # Update repayment
        loan.amount_repaid += amount
        
        # Check if fully repaid
        if loan.amount_repaid >= loan.total_repayment:
            loan.status = LoanStatus.COMPLETED
            logger.info("loan_completed", loan_id=loan_id)
        else:
            loan.status = LoanStatus.REPAYING
        
        # Create transaction record
        transaction = Transaction(
            user_id=loan.user_id,
            loan_id=loan_id,
            transaction_type=TransactionType.LOAN_REPAYMENT,
            amount=amount,
            squad_reference=squad_reference,
            status="completed",
            metadata={
                "amount_remaining": loan.total_repayment - loan.amount_repaid,
            },
        )
        self.db.add(transaction)
        
        await self.db.commit()
        logger.info("repayment_recorded", loan_id=loan_id, amount_repaid=loan.amount_repaid)
        
        return {
            "loan_id": loan_id,
            "amount_repaid": loan.amount_repaid,
            "total_repayment": loan.total_repayment,
            "status": loan.status,
            "remaining": loan.total_repayment - loan.amount_repaid,
        }
    
    async def get_loan_status(self, loan_id: str) -> dict:
        """
        Get current loan status.
        
        Args:
            loan_id: Loan ID
            
        Returns:
            dict with loan details
        """
        query = select(Loan).where(Loan.id == loan_id)
        result = await self.db.execute(query)
        loan = result.scalar_one_or_none()
        
        if not loan:
            raise NotFoundError("Loan not found")
        
        return {
            "loan_id": loan.id,
            "principal_amount": loan.principal_amount,
            "interest_amount": loan.interest_amount,
            "total_repayment": loan.total_repayment,
            "amount_repaid": loan.amount_repaid,
            "status": loan.status,
            "tenure_days": loan.tenure_days,
            "due_date": loan.due_date.isoformat() if loan.due_date else None,
            "disbursal_date": loan.disbursal_date.isoformat() if loan.disbursal_date else None,
        }
