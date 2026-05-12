"""
Authentication router — new role-first signup flow.
All responses use the { ok, data } / { ok, error, request_id } envelope.
Refresh token travels exclusively as HttpOnly Secure cookie.
"""
from fastapi import APIRouter, Depends, Request, Response, Cookie
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from src.core.database import get_db
from src.core.redis_client import get_redis_blacklist_dep
from src.dependencies import get_current_user
from src.services.auth import AuthService, _display_name
from src.schemas.auth import (
    RegisterSchema,
    VerifyOTPSchema,
    ResendOTPSchema,
    LoginSchema,
    UserProfileSchema,
    UserKYCSchema,
)
from src.core.security import verify_access_token
from src.core.exceptions import ZovuAPIError
from src.models import User
from src.config import settings
from typing import Optional
import structlog
import uuid

logger = structlog.get_logger()

router = APIRouter()

_COOKIE_NAME = "refresh_token"
_COOKIE_OPTS = dict(
    key=_COOKIE_NAME,
    httponly=True,
    secure=settings.ENVIRONMENT == "production",
    samesite="strict",
    max_age=settings.JWT_REFRESH_TTL_DAYS * 86400,
    path="/",
)


def _ok(data: dict, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"ok": True, "data": data})


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "display_name": _display_name(user),
        "email_verified": bool(user.email_verified),
        "profile_complete": bool(user.profile_complete),
        "squad_account_number": user.squad_account_number,
        "squad_account_bank": user.squad_account_bank,
        "squad_provisioned": bool(user.squad_provisioned),
    }


def _auth_response(token_data: dict, status_code: int = 200) -> JSONResponse:
    """Build envelope response and set refresh token cookie."""
    resp = JSONResponse(
        status_code=status_code,
        content={
            "ok": True,
            "data": {
                "access_token": token_data["access_token"],
                "token_type": "bearer",
                "expires_in": token_data["expires_in"],
                "user": _user_dict(token_data["user"]),
            },
        },
    )
    resp.set_cookie(value=token_data["refresh_token"], **_COOKIE_OPTS)
    return resp


# ------------------------------------------------------------------ #
#  POST /register                                                      #
# ------------------------------------------------------------------ #

@router.post("/register", status_code=201, summary="Register new account")
async def register(
    req: RegisterSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    """
    Create user account and trigger OTP email.
    Returns OTP in dev/sandbox mode for testing.
    """
    svc = AuthService(db, redis)
    data = await svc.register(
        role=req.role,
        email=str(req.email),
        password=req.password,
        confirm_password=req.confirm_password,
        business_name=req.business_name,
        full_name=req.full_name,
        company_name=req.company_name,
    )
    return _ok(data, status_code=201)


# ------------------------------------------------------------------ #
#  POST /verify-otp                                                    #
# ------------------------------------------------------------------ #

@router.post("/verify-otp", summary="Verify OTP → activate account → issue tokens")
async def verify_otp(
    req: VerifyOTPSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    """
    Verify 6-digit OTP.
    On success: activates account, provisions Squad VA, issues JWT + sets cookie.
    """
    svc = AuthService(db, redis)
    token_data = await svc.verify_otp(email=str(req.email), otp=req.otp)
    return _auth_response(token_data)


# ------------------------------------------------------------------ #
#  POST /resend-otp                                                    #
# ------------------------------------------------------------------ #

@router.post("/resend-otp", summary="Resend OTP (rate-limited: 3/hr per email)")
async def resend_otp(
    req: ResendOTPSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    svc = AuthService(db, redis)
    data = await svc.resend_otp(email=str(req.email))
    return _ok(data)


# ------------------------------------------------------------------ #
#  POST /login                                                         #
# ------------------------------------------------------------------ #

@router.post("/login", summary="Login with email + password")
async def login(
    req: LoginSchema,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
):
    svc = AuthService(db, redis)
    token_data = await svc.login(email=str(req.email), password=req.password)
    return _auth_response(token_data)


# ------------------------------------------------------------------ #
#  POST /refresh                                                       #
# ------------------------------------------------------------------ #

@router.post("/refresh", summary="Rotate refresh token → new access token")
async def refresh(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
    refresh_token: Optional[str] = Cookie(default=None, alias=_COOKIE_NAME),
):
    """
    Reads refresh token from HttpOnly cookie.
    Returns new access token; rotates refresh token cookie.
    """
    if not refresh_token:
        raise ZovuAPIError(
            status_code=401,
            code="MISSING_REFRESH_TOKEN",
            message="No refresh token cookie found",
        )
    svc = AuthService(db, redis)
    token_data = await svc.refresh_access_token(raw_refresh_token=refresh_token)
    return _auth_response(token_data)


# ------------------------------------------------------------------ #
#  POST /logout                                                        #
# ------------------------------------------------------------------ #

@router.post("/logout", summary="Logout — blacklist access token + clear cookie")
async def logout(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
    refresh_token: Optional[str] = Cookie(default=None, alias=_COOKIE_NAME),
):
    # Extract JTI + exp from the access token in the Authorization header
    raw_token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    payload = verify_access_token(raw_token)
    if not payload:
        raise ZovuAPIError(status_code=401, code="INVALID_TOKEN", message="Invalid access token")

    svc = AuthService(db, redis)
    await svc.logout(
        user_id=user.id,
        access_jti=payload["jti"],
        access_exp=payload["exp"],
        raw_refresh_token=refresh_token,
    )

    resp = _ok({"message": "Logged out successfully"})
    resp.delete_cookie(_COOKIE_NAME, path="/")
    return resp


# ------------------------------------------------------------------ #
#  GET /me                                                             #
# ------------------------------------------------------------------ #

@router.get("/me", summary="Get current user profile")
async def get_me(
    user: User = Depends(get_current_user),
):
    """Returns full profile from DB (not from JWT payload)."""
    return _ok(UserProfileSchema.model_validate(user).model_dump(mode="json"))


# ------------------------------------------------------------------ #
#  POST /kyc  (kept from original — unchanged)                        #
# ------------------------------------------------------------------ #

@router.post("/kyc", summary="Submit KYC documents")
async def submit_kyc(
    req: UserKYCSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        from src.core.security import encrypt_pii

        phone_encrypted = encrypt_pii(req.phone)
        bvn_encrypted = encrypt_pii(req.bvn) if req.bvn else None
        nin_encrypted = encrypt_pii(req.nin) if req.nin else None

        user.first_name = req.first_name
        user.last_name = req.last_name
        user.date_of_birth = req.date_of_birth
        user.phone = phone_encrypted
        user.bvn = bvn_encrypted
        user.nin = nin_encrypted

        await db.commit()

        from src.workers.fraud_tasks import verify_kyc_documents
        verify_kyc_documents.delay(user.id, req.bvn, req.nin)

        logger.info("kyc_submission_received", user_id=user.id)

        return _ok({
            "status": "submitted",
            "message": "KYC documents submitted. Verification in progress.",
        })
    except Exception as exc:
        logger.error("kyc_submission_failed", user_id=user.id, error=str(exc))
        raise ZovuAPIError(
            status_code=500,
            code="KYC_SUBMISSION_FAILED",
            message="KYC submission failed. Please try again.",
        )
