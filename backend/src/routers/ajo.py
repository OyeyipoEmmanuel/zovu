"""
Ajo router — create groups, join, track contributions.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional
from src.core.database import get_db
from src.dependencies import get_current_user
from src.services.ajo import AjoService
from src.models import User, AjoMembership
from src.core.exceptions import ValidationError, NotFoundError, ConflictError
from sqlalchemy import select
import structlog

logger = structlog.get_logger()

router = APIRouter()


# ------------------------------------------------------------------ #
#  Request schemas (body — not query params)                           #
# ------------------------------------------------------------------ #

class CreateAjoRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Group name")
    description: Optional[str] = Field(None, max_length=500, description="Group description")
    contribution_amount: int = Field(..., gt=0, description="Fixed contribution per member (KOBO)")
    contribution_frequency: str = Field(..., description="'weekly', 'biweekly', or 'monthly'")
    max_members: int = Field(..., ge=2, le=50, description="Max members (2-50)")


class ContributeRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Contribution amount in KOBO")


class PayoutRequest(BaseModel):
    member_index: int = Field(..., ge=1, description="Member's payout order position")


# ------------------------------------------------------------------ #
#  Endpoints                                                           #
# ------------------------------------------------------------------ #

@router.post(
    "",
    response_model=dict,
    tags=["Ajo"],
    summary="Create Ajo Group",
    description="Create new Ajo savings group",
)
async def create_ajo(
    body: CreateAjoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new Ajo (savings group). Current user becomes organizer.
    
    - **name**: Group name
    - **description**: Group description
    - **contribution_amount**: Fixed contribution per member (KOBO)
    - **contribution_frequency**: 'weekly', 'biweekly', or 'monthly'
    - **max_members**: Max members (2-50)
    """
    try:
        ajo_service = AjoService(db)
        return await ajo_service.create_ajo(
            organizer_id=user.id,
            name=body.name,
            description=body.description,
            contribution_amount=body.contribution_amount,
            contribution_frequency=body.contribution_frequency,
            max_members=body.max_members,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e.detail))
    except Exception as e:
        logger.error("ajo_creation_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ajo creation failed")


@router.post(
    "/{ajo_id}/join",
    response_model=dict,
    tags=["Ajo"],
    summary="Join Ajo Group",
    description="Join existing Ajo savings group",
)
async def join_ajo(
    ajo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Join existing Ajo group.
    
    - **ajo_id**: Ajo group ID
    """
    try:
        ajo_service = AjoService(db)
        return await ajo_service.join_ajo(ajo_id, user.id)
    except (NotFoundError, ConflictError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e.detail))
    except Exception as e:
        logger.error("ajo_join_failed", ajo_id=ajo_id, user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to join Ajo")


@router.post(
    "/{ajo_id}/contribute",
    response_model=dict,
    tags=["Ajo"],
    summary="Contribute to Ajo",
    description="Record contribution to Ajo group",
)
async def contribute_ajo(
    ajo_id: str,
    body: ContributeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Record contribution to Ajo group. Amount in KOBO.
    
    - **ajo_id**: Ajo group ID
    - **amount**: Contribution amount (KOBO)
    """
    try:
        # Get membership
        query = select(AjoMembership).where(
            AjoMembership.ajo_id == ajo_id,
            AjoMembership.user_id == user.id
        )
        result = await db.execute(query)
        membership = result.scalar_one_or_none()
        
        if not membership:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not a member of this Ajo")
        
        ajo_service = AjoService(db)
        return await ajo_service.record_contribution(membership.id, body.amount)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e.detail))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("ajo_contribution_failed", ajo_id=ajo_id, user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Contribution failed")


@router.post(
    "/{ajo_id}/payout",
    response_model=dict,
    tags=["Ajo"],
    summary="Distribute Ajo Payout",
    description="Trigger payout to the next member in rotation (organizer only)",
)
async def payout_ajo(
    ajo_id: str,
    body: PayoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Distribute payout to member at their turn. Organizer only.
    Uses Squad transfer to actually move funds.
    
    - **ajo_id**: Ajo group ID
    - **member_index**: Payout order position of the recipient
    """
    try:
        import httpx
        from src.core.redis_client import get_redis_cache
        from src.services.squad import SquadService
        from src.models import Ajo
        from sqlalchemy import select as sa_select

        # Verify caller is the organizer
        q = sa_select(Ajo).where(Ajo.id == ajo_id)
        res = await db.execute(q)
        ajo = res.scalar_one_or_none()
        if not ajo:
            raise HTTPException(status_code=404, detail="Ajo group not found")
        if ajo.organizer_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organizer can trigger payouts")

        # Get redis from app state (non-fatal if unavailable)
        redis = None
        try:
            from src.core.redis_client import redis_client
            redis = await redis_client.get_pool(0)
        except Exception:
            pass

        async with httpx.AsyncClient(timeout=30.0) as http:
            squad_svc = SquadService(db=db, redis=redis, http=http)
            ajo_service = AjoService(db)
            return await ajo_service.distribute_payout(
                ajo_id=ajo_id,
                member_index=body.member_index,
                squad_service=squad_svc,
            )
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e.detail))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("ajo_payout_failed", ajo_id=ajo_id, user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Payout failed")


@router.get(
    "/{ajo_id}",
    response_model=dict,
    tags=["Ajo"],
    summary="Get Ajo Details",
    description="Get Ajo group details with members",
)
async def get_ajo(
    ajo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get Ajo group details including member list.
    
    - **ajo_id**: Ajo group ID
    """
    try:
        ajo_service = AjoService(db)
        return await ajo_service.get_ajo_details(ajo_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e.detail))
    except Exception as e:
        logger.error("ajo_details_failed", ajo_id=ajo_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get Ajo details")


@router.get(
    "",
    response_model=dict,
    tags=["Ajo"],
    summary="List My Ajo Groups",
    description="List all Ajo groups the current user belongs to",
)
async def list_my_ajos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all Ajo groups the current user is a member of.
    """
    try:
        from src.models import Ajo
        # Get all memberships for this user
        q = select(AjoMembership).where(AjoMembership.user_id == user.id)
        result = await db.execute(q)
        memberships = result.scalars().all()

        if not memberships:
            return {"groups": [], "total": 0}

        ajo_ids = [m.ajo_id for m in memberships]
        q2 = select(Ajo).where(Ajo.id.in_(ajo_ids))
        result2 = await db.execute(q2)
        ajos = result2.scalars().all()

        membership_by_ajo = {m.ajo_id: m for m in memberships}

        return {
            "groups": [
                {
                    "ajo_id": a.id,
                    "name": a.name,
                    "contribution_amount": a.contribution_amount,
                    "contribution_frequency": a.contribution_frequency,
                    "total_balance": a.total_balance,
                    "max_members": a.max_members,
                    "status": a.status,
                    "my_payout_order": membership_by_ajo[a.id].payout_order,
                    "my_total_contributed": membership_by_ajo[a.id].total_contributed,
                    "my_total_received": membership_by_ajo[a.id].total_received,
                }
                for a in ajos
            ],
            "total": len(ajos),
        }
    except Exception as e:
        logger.error("list_ajos_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list Ajo groups")
