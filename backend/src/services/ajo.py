"""
Ajo (savings group) service — group creation, member management, contributions, payouts.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.models import Ajo, AjoMembership, AjoStatus, User, Transaction, TransactionType
from src.core.exceptions import NotFoundError, ValidationError, ConflictError
import structlog
from datetime import datetime, timezone
import uuid

logger = structlog.get_logger()


class AjoService:
    """Ajo savings group service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_ajo(
        self,
        organizer_id: str,
        name: str,
        description: str,
        contribution_amount: int,
        contribution_frequency: str,
        max_members: int,
    ) -> dict:
        """
        Create new Ajo savings group.
        Amount in KOBO.
        
        Args:
            organizer_id: User ID of group organizer
            name: Group name
            description: Group description
            contribution_amount: Fixed contribution per member per cycle (KOBO)
            contribution_frequency: 'weekly', 'biweekly', 'monthly'
            max_members: Max members (2-50)
            
        Returns:
            dict with ajo details
            
        Raises:
            ValidationError: If input invalid
        """
        if contribution_amount <= 0:
            raise ValidationError("Contribution amount must be positive")
        
        if max_members < 2 or max_members > 50:
            raise ValidationError("Max members must be between 2 and 50")
        
        if contribution_frequency not in ["weekly", "biweekly", "monthly"]:
            raise ValidationError("Invalid contribution frequency")
        
        logger.info("ajo_creation_started", organizer_id=organizer_id, name=name)
        
        # Verify organizer exists
        query = select(User).where(User.id == organizer_id)
        result = await self.db.execute(query)
        organizer = result.scalar_one_or_none()
        
        if not organizer:
            raise NotFoundError("Organizer not found")
        
        # Create ajo
        ajo = Ajo(
            name=name,
            description=description,
            organizer_id=organizer_id,
            contribution_amount=contribution_amount,
            contribution_frequency=contribution_frequency,
            max_members=max_members,
            status=AjoStatus.ACTIVE,
            payout_schedule=[],  # Will be populated as members join
        )
        self.db.add(ajo)
        await self.db.flush()
        
        # Add organizer as first member
        membership = AjoMembership(
            ajo_id=ajo.id,
            user_id=organizer_id,
            payout_order=1,
        )
        self.db.add(membership)
        
        await self.db.commit()
        logger.info("ajo_created", ajo_id=ajo.id, organizer_id=organizer_id)
        
        return {
            "ajo_id": ajo.id,
            "name": name,
            "contribution_amount": contribution_amount,
            "contribution_frequency": contribution_frequency,
            "max_members": max_members,
            "members": 1,  # Just organizer
            "status": AjoStatus.ACTIVE,
        }
    
    async def join_ajo(self, ajo_id: str, user_id: str) -> dict:
        """
        Join existing Ajo group.
        
        Args:
            ajo_id: Ajo group ID
            user_id: User joining
            
        Returns:
            dict with membership details
            
        Raises:
            NotFoundError: If ajo not found
            ConflictError: If already member or group full
        """
        logger.info("ajo_join_started", ajo_id=ajo_id, user_id=user_id)
        
        # Get ajo
        query = select(Ajo).where(Ajo.id == ajo_id)
        result = await self.db.execute(query)
        ajo = result.scalar_one_or_none()
        
        if not ajo:
            raise NotFoundError("Ajo group not found")
        
        if ajo.status != AjoStatus.ACTIVE:
            raise ConflictError("Ajo group is not active")
        
        # Check if already member
        query = select(AjoMembership).where(
            AjoMembership.ajo_id == ajo_id,
            AjoMembership.user_id == user_id
        )
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ConflictError("Already a member of this group")
        
        # Get current member count
        query = select(func.count(AjoMembership.id)).where(AjoMembership.ajo_id == ajo_id)
        result = await self.db.execute(query)
        member_count = result.scalar()
        
        if member_count >= ajo.max_members:
            raise ConflictError("Group is full")
        
        # Add member
        payout_order = member_count + 1
        membership = AjoMembership(
            ajo_id=ajo_id,
            user_id=user_id,
            payout_order=payout_order,
        )
        self.db.add(membership)
        
        # Update payout schedule
        if not ajo.payout_schedule:
            ajo.payout_schedule = []
        ajo.payout_schedule.append({"order": payout_order, "user_id": user_id})
        
        await self.db.commit()
        logger.info("user_joined_ajo", ajo_id=ajo_id, user_id=user_id)
        
        return {
            "membership_id": membership.id,
            "ajo_id": ajo_id,
            "user_id": user_id,
            "payout_order": payout_order,
            "contribution_amount": ajo.contribution_amount,
            "message": f"Joined as member #{payout_order}",
        }
    
    async def record_contribution(self, membership_id: str, amount: int) -> dict:
        """
        Record contribution from member.
        Amount in KOBO.
        
        Args:
            membership_id: AjoMembership ID
            amount: Contribution amount
            
        Returns:
            dict with updated contribution totals
            
        Raises:
            ValidationError: If amount invalid
            NotFoundError: If membership not found
        """
        if amount <= 0:
            raise ValidationError("Amount must be positive")
        
        logger.info("ajo_contribution_started", membership_id=membership_id, amount=amount)
        
        # Get membership
        query = select(AjoMembership).where(AjoMembership.id == membership_id)
        result = await self.db.execute(query)
        membership = result.scalar_one_or_none()
        
        if not membership:
            raise NotFoundError("Membership not found")
        
        # Get ajo
        query = select(Ajo).where(Ajo.id == membership.ajo_id)
        result = await self.db.execute(query)
        ajo = result.scalar_one_or_none()
        
        # Get contributing user to update their personal ajo_savings_balance
        query = select(User).where(User.id == membership.user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        # Update contribution totals
        membership.total_contributed += amount
        ajo.total_balance += amount
        
        # FIX: Update the user's personal ajo_savings_balance field
        if user:
            user.ajo_savings_balance = (user.ajo_savings_balance or 0) + amount
        
        # Create transaction record
        # FIX: Added required `direction` field — contribution is a debit (money leaving member)
        transaction = Transaction(
            sender_id=membership.user_id,
            receiver_id=None,
            transaction_type=TransactionType.AJO_CONTRIBUTION,
            amount=amount,
            direction="debit",   # money leaves the contributing member's wallet
            status="completed",
            tx_metadata={
                "ajo_id": ajo.id,
                "ajo_name": ajo.name,
                "contribution_frequency": ajo.contribution_frequency,
                "membership_id": membership_id,
            },
        )
        self.db.add(transaction)
        
        await self.db.commit()
        logger.info(
            "contribution_recorded",
            membership_id=membership_id,
            amount=amount,
            total_contributed=membership.total_contributed,
        )
        
        return {
            "membership_id": membership_id,
            "amount_contributed": amount,
            "total_contributed": membership.total_contributed,
            "group_balance": ajo.total_balance,
            "status": "completed",
        }
    
    async def distribute_payout(
        self,
        ajo_id: str,
        member_index: int,
        squad_service=None,
    ) -> dict:
        """
        Distribute payout to member at their turn in rotation.
        Initiates a real Squad transfer if squad_service is provided.
        
        Args:
            ajo_id: Ajo group ID
            member_index: Member's position in payout order
            squad_service: Optional SquadService instance for real money movement
            
        Returns:
            dict with payout details
            
        Raises:
            NotFoundError: If ajo not found
        """
        logger.info("ajo_payout_started", ajo_id=ajo_id, member_index=member_index)
        
        # Get ajo
        query = select(Ajo).where(Ajo.id == ajo_id)
        result = await self.db.execute(query)
        ajo = result.scalar_one_or_none()
        
        if not ajo:
            raise NotFoundError("Ajo group not found")
        
        # Calculate total payout (sum of all contributions in group)
        payout_amount = ajo.total_balance
        
        if payout_amount <= 0:
            raise ValidationError("No funds available for payout")
        
        # Get member receiving payout
        query = select(AjoMembership).where(
            AjoMembership.ajo_id == ajo_id,
            AjoMembership.payout_order == member_index
        )
        result = await self.db.execute(query)
        membership = result.scalar_one_or_none()
        
        if not membership:
            raise NotFoundError("Member not found for payout")
        
        # Get receiving user for their Squad account number
        query = select(User).where(User.id == membership.user_id)
        result = await self.db.execute(query)
        recipient_user = result.scalar_one_or_none()
        
        # Generate a unique reference for this payout
        payout_ref = f"ajo-payout-{uuid.uuid4().hex}"
        
        # Default status — will be upgraded if Squad transfer succeeds
        payout_status = "pending"
        squad_transfer_result = None
        
        # Attempt real Squad transfer if service provided and user has a VA number
        if squad_service and recipient_user and recipient_user.squad_account_number:
            try:
                squad_transfer_result = await squad_service.transfer_funds(
                    recipient_account=recipient_user.squad_account_number,
                    amount_kobo=payout_amount,
                    reference=payout_ref,
                    narration=f"Ajo payout — {ajo.name}",
                )
                # If transfer was accepted by Squad (even if still processing), mark as processing
                payout_status = squad_transfer_result.get("status", "pending")
                if payout_status in ("success", "successful", "completed"):
                    payout_status = "completed"
                logger.info(
                    "ajo_squad_transfer_initiated",
                    ajo_id=ajo_id,
                    user_id=membership.user_id,
                    reference=payout_ref,
                    squad_status=payout_status,
                )
            except Exception as exc:
                logger.error(
                    "ajo_squad_transfer_failed",
                    ajo_id=ajo_id,
                    user_id=membership.user_id,
                    error=str(exc),
                )
                # Keep payout_status as "pending" — webhook will complete it
        else:
            logger.warning(
                "ajo_payout_no_squad_service_or_account",
                ajo_id=ajo_id,
                user_id=membership.user_id,
                has_service=squad_service is not None,
                has_account=bool(recipient_user and recipient_user.squad_account_number),
            )
        
        # Update membership and ajo balance
        membership.total_received += payout_amount
        ajo.total_balance -= payout_amount
        
        # Update recipient's ajo_savings_balance to reflect payout deduction
        if recipient_user:
            recipient_user.ajo_savings_balance = max(
                0, (recipient_user.ajo_savings_balance or 0) - payout_amount
            )
        
        # Create transaction record
        # FIX: Added required `direction` field — payout is a credit (money arriving for recipient)
        transaction = Transaction(
            sender_id=None,
            receiver_id=membership.user_id,
            transaction_type=TransactionType.AJO_PAYOUT,
            amount=payout_amount,
            direction="credit",   # money arrives for the recipient member
            squad_reference=payout_ref,
            status=payout_status,
            tx_metadata={
                "ajo_id": ajo_id,
                "ajo_name": ajo.name,
                "payout_order": member_index,
                "squad_transfer": squad_transfer_result,
            },
        )
        self.db.add(transaction)
        
        await self.db.commit()
        logger.info(
            "payout_distributed",
            ajo_id=ajo_id,
            user_id=membership.user_id,
            amount=payout_amount,
            status=payout_status,
        )
        
        return {
            "ajo_id": ajo_id,
            "user_id": membership.user_id,
            "payout_amount": payout_amount,
            "payout_reference": payout_ref,
            "status": payout_status,
            "message": (
                "Payout completed successfully"
                if payout_status == "completed"
                else "Payout initiated — will complete shortly"
            ),
        }
    
    async def get_ajo_details(self, ajo_id: str) -> dict:
        """
        Get Ajo group details with members.
        
        Args:
            ajo_id: Ajo group ID
            
        Returns:
            dict with group details
        """
        query = select(Ajo).where(Ajo.id == ajo_id)
        result = await self.db.execute(query)
        ajo = result.scalar_one_or_none()
        
        if not ajo:
            raise NotFoundError("Ajo group not found")
        
        # Get members
        query = select(AjoMembership).where(AjoMembership.ajo_id == ajo_id)
        result = await self.db.execute(query)
        memberships = result.scalars().all()
        
        return {
            "ajo_id": ajo.id,
            "name": ajo.name,
            "description": ajo.description,
            "contribution_amount": ajo.contribution_amount,
            "contribution_frequency": ajo.contribution_frequency,
            "total_balance": ajo.total_balance,
            "member_count": len(memberships),
            "max_members": ajo.max_members,
            "status": ajo.status,
            "members": [
                {
                    "user_id": m.user_id,
                    "payout_order": m.payout_order,
                    "total_contributed": m.total_contributed,
                    "total_received": m.total_received,
                }
                for m in memberships
            ],
        }
