"""
Ajo router — create groups, join, track contributions.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.dependencies import get_current_user
from src.services.ajo import AjoService
from src.models import User
from src.core.exceptions import ValidationError, NotFoundError, ConflictError
import structlog

logger = structlog.get_logger()

router = APIRouter()


@router.post(
    "",
    response_model=dict,
    tags=["Ajo"],
    summary="Create Ajo Group",
    description="Create new Ajo savings group",
)
async def create_ajo(
    name: str,
    description: str = None,
    contribution_amount: int = None,
    contribution_frequency: str = None,
    max_members: int = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new Ajo (savings group).
    Current user becomes organizer.
    
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
            name=name,
            description=description,
            contribution_amount=contribution_amount,
            contribution_frequency=contribution_frequency,
            max_members=max_members,
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
    amount: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Record contribution to Ajo group.
    Amount in KOBO.
    
    - **ajo_id**: Ajo group ID
    - **amount**: Contribution amount (KOBO)
    """
    try:
        from sqlalchemy import select
        from src.models import AjoMembership
        
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
        return await ajo_service.record_contribution(membership.id, amount)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e.detail))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("ajo_contribution_failed", ajo_id=ajo_id, user_id=user.id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Contribution failed")


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
