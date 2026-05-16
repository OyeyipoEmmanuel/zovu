"""Authenticated user utility routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.exceptions import ZovuAPIError
from src.dependencies import get_current_user
from src.models import User

router = APIRouter(prefix="/users", tags=["Users"])


def _full_name(user: User) -> str:
    return (
        (user.full_name or "").strip()
        or f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
        or user.email
        or "ZOVU User"
    )


def _same_id(left: str, right: str) -> bool:
    return left == right or left.replace("-", "") == right.replace("-", "")


@router.get("/{user_id}/va-details", response_model=dict, summary="Get Squad VA deposit details")
async def get_va_details(
    user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _same_id(user.id, user_id):
        raise ZovuAPIError(status_code=403, code="FORBIDDEN", message="You can only fetch your own VA details")

    user = await db.merge(user)
    if not user.squad_account_number:
        raise ZovuAPIError(
            status_code=404,
            code="VA_NOT_PROVISIONED",
            message="Squad virtual account has not been provisioned for this user yet.",
        )

    return {
        "ok": True,
        "data": {
            "account_number": user.squad_account_number,
            "bank_name": "GTBank",
            "account_name": f"ZOVU / {_full_name(user)}",
            "payment_reference": f"ZVU-{user.id[:8]}",
        },
    }
