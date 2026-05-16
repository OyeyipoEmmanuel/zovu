"""
API routers module — all route groups.
"""
from src.routers.auth import router as auth_router
from src.routers.users import router as users_router
from src.routers.credit import router as credit_router
from src.routers.gigs import router as gigs_router
from src.routers.applications import router as applications_router
from src.routers.lenders import router as lenders_router
from src.routers.job_seekers import router as job_seekers_router
from src.routers.loans import router as loans_router
from src.routers.transactions import router as transactions_router
from src.routers.ajo import router as ajo_router
from src.routers.referral import router as referral_router
from src.routers.webhooks import router as webhooks_router
from src.routers.admin import router as admin_router
from src.routers.reviews import router as reviews_router
from src.routers.partner_recommendations import router as partner_recommendations_router

__all__ = [
    "auth_router",
    "users_router",
    "credit_router",
    "gigs_router",
    "applications_router",
    "lenders_router",
    "job_seekers_router",
    "loans_router",
    "transactions_router",
    "ajo_router",
    "referral_router",
    "webhooks_router",
    "admin_router",
    "reviews_router",
    "partner_recommendations_router",
]
