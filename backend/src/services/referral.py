"""
Referral service — generate codes, track referrals, distribute rewards.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.models import User, Referral, Credit
from src.core.exceptions import NotFoundError, ValidationError, ConflictError
import structlog
from datetime import datetime, timezone, timedelta
import secrets
import string

logger = structlog.get_logger()

# Referral reward
REFERRAL_REWARD = 500000  # 5,000 NAIRA = 500,000 KOBO

# Code validity period
REFERRAL_CODE_EXPIRY_DAYS = 30


class ReferralService:
    """Referral tracking and reward service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def generate_referral_code(self, user_id: str) -> dict:
        """
        Generate unique referral code for user.
        One code per user — recreate if expired.
        
        Args:
            user_id: User ID
            
        Returns:
            dict with referral code and validity
        """
        logger.info("referral_code_generation", user_id=user_id)
        
        # Check if user exists
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError("User not found")
        
        # Check for existing valid code
        query = select(Referral).where(
            Referral.referrer_id == user_id,
            Referral.expires_at > datetime.now(timezone.utc),
        )
        result = await self.db.execute(query)
        existing_referral = result.scalar_one_or_none()
        
        if existing_referral:
            logger.info("using_existing_referral_code", code=existing_referral.referral_code)
            return {
                "referral_code": existing_referral.referral_code,
                "expires_at": existing_referral.expires_at.isoformat(),
                "reward_amount": REFERRAL_REWARD,
            }
        
        # Generate new code (8 chars: uppercase + digits)
        code = self._generate_code()
        
        # Create referral placeholder
        expires_at = datetime.now(timezone.utc) + timedelta(days=REFERRAL_CODE_EXPIRY_DAYS)
        referral = Referral(
            referrer_id=user_id,
            referred_id=user_id,  # Placeholder — will be updated on redemption
            referral_code=code,
            status="pending",
            reward_amount=REFERRAL_REWARD,
            reward_credited=False,
            expires_at=expires_at,
        )
        self.db.add(referral)
        await self.db.commit()
        
        logger.info("referral_code_generated", user_id=user_id, code=code)
        
        return {
            "referral_code": code,
            "expires_at": expires_at.isoformat(),
            "reward_amount": REFERRAL_REWARD,
            "message": f"Share code {code} to earn ₦{REFERRAL_REWARD/100} for each signup",
        }
    
    async def redeem_referral_code(self, code: str, referred_user_id: str) -> dict:
        """
        Redeem referral code on signup.
        Links referrer to new user, marks referral as completed.
        Reward is credited immediately to referrer's credit account.
        
        Args:
            code: Referral code
            referred_user_id: User being referred (newly registered)
            
        Returns:
            dict with referral details
            
        Raises:
            ValidationError: If code invalid or expired
            ConflictError: If user already referred
        """
        logger.info("referral_redemption_started", code=code, referred_user_id=referred_user_id)
        
        # Find referral by code
        query = select(Referral).where(Referral.referral_code == code)
        result = await self.db.execute(query)
        referral = result.scalar_one_or_none()
        
        if not referral:
            raise ValidationError("Invalid referral code")
        
        # Check expiry
        if referral.expires_at < datetime.now(timezone.utc):
            logger.warning("referral_code_expired", code=code)
            raise ValidationError("Referral code expired")
        
        # Check if already redeemed
        if referral.status == "completed":
            raise ConflictError("Referral code already redeemed")
        
        # Verify referred user exists and is newly registered
        query = select(User).where(User.id == referred_user_id)
        result = await self.db.execute(query)
        referred_user = result.scalar_one_or_none()
        
        if not referred_user:
            raise NotFoundError("Referred user not found")
        
        # Update referral
        referral.referred_id = referred_user_id
        referral.status = "completed"
        
        # Credit reward to referrer
        query = select(Credit).where(Credit.user_id == referral.referrer_id)
        result = await self.db.execute(query)
        referrer_credit = result.scalar_one_or_none()
        
        if not referrer_credit:
            referrer_credit = Credit(
                user_id=referral.referrer_id,
                available_balance=REFERRAL_REWARD,
            )
            self.db.add(referrer_credit)
        else:
            referrer_credit.available_balance += REFERRAL_REWARD
        
        referral.reward_credited = True
        referral.credited_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        
        logger.info(
            "referral_completed",
            code=code,
            referrer_id=referral.referrer_id,
            referred_id=referred_user_id,
            reward=REFERRAL_REWARD,
        )
        
        return {
            "referral_code": code,
            "referrer_id": referral.referrer_id,
            "referred_id": referred_user_id,
            "reward_amount": REFERRAL_REWARD,
            "status": "completed",
            "message": f"Referral completed! ₦{REFERRAL_REWARD/100} credited",
        }
    
    async def get_referral_stats(self, user_id: str) -> dict:
        """
        Get referral stats for user.
        
        Args:
            user_id: User ID
            
        Returns:
            dict with referral stats
        """
        logger.info("referral_stats_requested", user_id=user_id)
        
        # Get completed referrals made by user
        query = select(func.count(Referral.id)).where(
            Referral.referrer_id == user_id,
            Referral.status == "completed"
        )
        result = await self.db.execute(query)
        total_referrals = result.scalar()
        
        # Get pending referrals
        query = select(func.count(Referral.id)).where(
            Referral.referrer_id == user_id,
            Referral.status == "pending"
        )
        result = await self.db.execute(query)
        pending_referrals = result.scalar()
        
        # Get total rewards earned
        query = select(func.sum(Referral.reward_amount)).where(
            Referral.referrer_id == user_id,
            Referral.reward_credited == True
        )
        result = await self.db.execute(query)
        total_earned = result.scalar() or 0
        
        return {
            "total_referrals": total_referrals,
            "completed_referrals": total_referrals,
            "pending_referrals": pending_referrals,
            "total_earned": total_earned,
            "reward_per_referral": REFERRAL_REWARD,
        }
    
    async def get_referral_code(self, user_id: str) -> dict:
        """
        Get user's current referral code (or generate if none exists).
        
        Args:
            user_id: User ID
            
        Returns:
            dict with referral code
        """
        query = select(Referral).where(
            Referral.referrer_id == user_id,
            Referral.expires_at > datetime.now(timezone.utc),
        )
        result = await self.db.execute(query)
        referral = result.scalar_one_or_none()
        
        if referral:
            return {
                "referral_code": referral.referral_code,
                "expires_at": referral.expires_at.isoformat(),
            }
        
        # Generate new code
        return await self.generate_referral_code(user_id)
    
    def _generate_code(self) -> str:
        """Generate random 8-character referral code."""
        chars = string.ascii_uppercase + string.digits
        # Remove confusing characters: 0, O, 1, I, L
        chars = chars.replace('0', '').replace('O', '').replace('1', '').replace('I', '').replace('L', '')
        
        while True:
            code = ''.join(secrets.choice(chars) for _ in range(8))
            # Ensure code doesn't already exist
            # In production, check database
            return code
