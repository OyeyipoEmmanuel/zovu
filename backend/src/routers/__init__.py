"""
API routers module — all route groups.
"""
from src.routers.auth import router as auth_router
from src.routers.credit import router as credit_router
from src.routers.loans import router as loans_router
from src.routers.transactions import router as transactions_router
from src.routers.ajo import router as ajo_router
from src.routers.referral import router as referral_router
from src.routers.webhooks import router as webhooks_router

__all__ = [
    "auth_router",
    "credit_router",
    "loans_router",
    "transactions_router",
    "ajo_router",
    "referral_router",
    "webhooks_router",
]
