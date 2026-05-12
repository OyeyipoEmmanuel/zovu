"""
Authentication service — new role-first signup flow.
OTPs stored as sha256 hash in Redis (never in DB).
Refresh tokens are opaque (secrets.token_urlsafe), stored hashed in DB.
Rotation with theft detection via used_at.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from src.models import User, RefreshToken
from src.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
    hash_refresh_token,
    validate_password_strength,
    blacklist_token,
)
from src.core.exceptions import ZovuAPIError
from src.config import settings
import structlog
import uuid
from datetime import datetime, timedelta, timezone
from redis.asyncio import Redis
import secrets
import hashlib
from fastapi import status as http_status

logger = structlog.get_logger()

_OTP_TTL = 600          # 10 minutes
_OTP_ATTEMPTS_TTL = 3600  # 1 hour window for attempt counter
_OTP_MAX_ATTEMPTS = 5
_OTP_RESEND_TTL = 3600  # 1 hour window for resend counter
_OTP_MAX_RESENDS = 3

# Dev-mode in-memory OTP store (used when Redis is unavailable in non-production)
_dev_otp_store: dict[str, str] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _display_name(user: User) -> str:
    return user.business_name or user.full_name or user.company_name or user.first_name or user.email


class AuthService:
    """Authentication service — new signup flow."""

    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    # ------------------------------------------------------------------ #
    #  Register                                                            #
    # ------------------------------------------------------------------ #

    async def register(
        self,
        role: str,
        email: str,
        password: str,
        confirm_password: str,
        business_name: str | None,
        full_name: str | None,
        company_name: str | None,
    ) -> dict:
        """
        Step 2 of signup. Creates user, stores OTP in Redis, sends email.
        Returns 201 with OTP in dev mode.
        """
        email = email.lower().strip()

        # 1. Password match
        if password != confirm_password:
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="PASSWORD_MISMATCH",
                message="Passwords do not match",
                field="confirm_password",
            )

        # 2. Password strength
        try:
            validate_password_strength(password)
        except ValueError as exc:
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="WEAK_PASSWORD",
                message=str(exc),
                field="password",
            )

        # 3. Role-specific name field
        if role == "trader" and not business_name:
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="VALIDATION_ERROR",
                message="business_name is required for traders",
                field="business_name",
            )
        if role == "job_seeker" and not full_name:
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="VALIDATION_ERROR",
                message="full_name is required for job seekers",
                field="full_name",
            )
        if role == "lender" and not company_name:
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="VALIDATION_ERROR",
                message="company_name is required for lenders",
                field="company_name",
            )

        # 4. Email uniqueness
        existing = await self.db.scalar(select(User).where(User.email == email))
        if existing:
            raise ZovuAPIError(
                status_code=http_status.HTTP_409_CONFLICT,
                code="EMAIL_ALREADY_EXISTS",
                message="An account with this email already exists",
                field="email",
            )

        # 5. Create user
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            password_hash=hash_password(password),
            role=role,
            email_verified=False,
            profile_complete=False,
            is_banned=False,
            squad_provisioned=False,
            business_name=business_name,
            full_name=full_name,
            company_name=company_name,
            phone=b"",  # placeholder — filled during KYC
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        logger.info("user_created", user_id=user.id, email=email, role=role)

        # 6. Generate + store OTP in Redis
        otp_code = await self._store_otp(email)

        # 7. Send OTP email
        await self._send_otp_email(user, otp_code)

        response: dict = {
            "message": "OTP sent to your email",
            "email": email,
        }
        if settings.ENVIRONMENT != "production":
            response["otp"] = otp_code

        return response

    # ------------------------------------------------------------------ #
    #  Verify OTP                                                          #
    # ------------------------------------------------------------------ #

    async def verify_otp(self, email: str, otp: str) -> dict:
        """
        Verify OTP → activate account → provision Squad VA → issue tokens.
        Returns tokens + user data; caller sets refresh token as cookie.
        """
        email = email.lower().strip()

        # 1. Check attempt counter
        await self._check_otp_attempts(email)

        # 2. Fetch stored hash (Redis first, then dev fallback)
        stored_hash: str | None = None
        try:
            raw = await self.redis.get(f"otp:{email}")
            if raw:
                stored_hash = raw.decode() if isinstance(raw, bytes) else raw
        except Exception:
            stored_hash = _dev_otp_store.get(email)

        if not stored_hash:
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="OTP_EXPIRED",
                message="OTP has expired or was not found. Request a new one.",
            )

        # 3. Compare hash
        otp_hash = hashlib.sha256(otp.encode()).hexdigest()
        if otp_hash != stored_hash:
            try:
                await self.redis.incr(f"otp:attempts:{email}")
                await self.redis.expire(f"otp:attempts:{email}", _OTP_ATTEMPTS_TTL)
            except Exception:
                pass
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="INVALID_OTP",
                message="The OTP you entered is incorrect",
            )

        # 4. Consume OTP — single-use
        try:
            await self.redis.delete(f"otp:{email}")
            await self.redis.delete(f"otp:attempts:{email}")
        except Exception:
            _dev_otp_store.pop(email, None)

        # 5. Activate account
        user = await self.db.scalar(select(User).where(User.email == email))
        if not user:
            raise ZovuAPIError(
                status_code=http_status.HTTP_404_NOT_FOUND,
                code="USER_NOT_FOUND",
                message="User not found",
            )

        user.email_verified = True
        await self.db.commit()
        await self.db.refresh(user)

        logger.info("email_verified", user_id=user.id, email=email)

        # 6. Provision Squad VA (non-fatal failure — Celery fallback)
        await self._provision_squad(user)

        # 7. Send welcome email (fire-and-forget)
        try:
            from src.services.email_service import EmailService
            svc = EmailService()
            await svc.send_welcome(
                to_email=user.email,
                user_name=_display_name(user),
                account_number=user.squad_account_number,
            )
        except Exception as exc:
            logger.warning("welcome_email_failed", user_id=user.id, error=str(exc))

        # 8. Issue tokens
        return await self._generate_tokens(user)

    # ------------------------------------------------------------------ #
    #  Resend OTP                                                          #
    # ------------------------------------------------------------------ #

    async def resend_otp(self, email: str) -> dict:
        """Rate-limited OTP resend (3 per hour per email)."""
        email = email.lower().strip()

        # Check resend rate limit
        resend_key = f"otp:resend:{email}"
        try:
            resend_count = await self.redis.get(resend_key)
        except Exception:
            resend_count = None
        if resend_count and int(resend_count) >= _OTP_MAX_RESENDS:
            raise ZovuAPIError(
                status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                code="TOO_MANY_RESENDS",
                message="Too many OTP resend attempts. Try again in an hour.",
            )

        # Ensure user exists and is not already verified
        user = await self.db.scalar(select(User).where(User.email == email))
        if not user:
            raise ZovuAPIError(
                status_code=http_status.HTTP_404_NOT_FOUND,
                code="USER_NOT_FOUND",
                message="No account found with this email",
            )
        if user.email_verified:
            raise ZovuAPIError(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                code="ALREADY_VERIFIED",
                message="This email is already verified",
            )

        # Delete old OTP, generate new one
        try:
            await self.redis.delete(f"otp:{email}")
            await self.redis.delete(f"otp:attempts:{email}")
        except Exception:
            _dev_otp_store.pop(email, None)
        otp_code = await self._store_otp(email)

        # Increment resend counter
        try:
            await self.redis.incr(resend_key)
            await self.redis.expire(resend_key, _OTP_RESEND_TTL)
        except Exception:
            pass

        await self._send_otp_email(user, otp_code)

        response: dict = {"message": "New OTP sent to your email", "email": email}
        if settings.ENVIRONMENT != "production":
            response["otp"] = otp_code

        return response

    # ------------------------------------------------------------------ #
    #  Login                                                               #
    # ------------------------------------------------------------------ #

    async def login(self, email: str, password: str) -> dict:
        """Email + password login. Triggers OTP resend if unverified."""
        email = email.lower().strip()
        logger.info("login_attempt", email=email)

        user = await self.db.scalar(select(User).where(User.email == email))
        if not user:
            raise ZovuAPIError(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                code="INVALID_CREDENTIALS",
                message="Invalid email or password",
            )

        if not verify_password(password, user.password_hash):
            raise ZovuAPIError(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                code="INVALID_CREDENTIALS",
                message="Invalid email or password",
            )

        if not user.email_verified:
            # Trigger OTP resend silently
            try:
                await self.resend_otp(email)
            except Exception:
                pass
            raise ZovuAPIError(
                status_code=http_status.HTTP_403_FORBIDDEN,
                code="EMAIL_NOT_VERIFIED",
                message="Please verify your email. A new OTP has been sent.",
            )

        if user.is_banned:
            raise ZovuAPIError(
                status_code=http_status.HTTP_403_FORBIDDEN,
                code="ACCOUNT_SUSPENDED",
                message=user.ban_reason or "Your account has been suspended.",
            )

        logger.info("login_successful", user_id=user.id, email=email)
        return await self._generate_tokens(user)

    # ------------------------------------------------------------------ #
    #  Refresh                                                             #
    # ------------------------------------------------------------------ #

    async def refresh_access_token(self, raw_refresh_token: str) -> dict:
        """
        Rotate opaque refresh token.
        Theft detection: if used_at is already set → revoke entire family.
        """
        token_hash = hash_refresh_token(raw_refresh_token)
        record = await self.db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )

        if not record or record.is_revoked:
            raise ZovuAPIError(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                code="INVALID_REFRESH_TOKEN",
                message="Refresh token is invalid or revoked",
            )

        # Theft detection
        if record.used_at is not None:
            logger.warning("refresh_token_reuse_detected", family_id=record.family_id)
            await self._revoke_family(record.family_id)
            raise ZovuAPIError(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                code="TOKEN_REUSE_DETECTED",
                message="Token reuse detected. Please log in again.",
            )

        if record.expires_at.replace(tzinfo=timezone.utc) < _utcnow():
            raise ZovuAPIError(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                code="REFRESH_TOKEN_EXPIRED",
                message="Refresh token has expired",
            )

        user = await self.db.scalar(select(User).where(User.id == record.user_id))
        if not user:
            raise ZovuAPIError(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                code="USER_NOT_FOUND",
                message="User not found",
            )

        # Mark token consumed (theft detection trip wire)
        record.used_at = _utcnow()
        await self.db.commit()

        return await self._generate_tokens(user, family_id=record.family_id)

    # ------------------------------------------------------------------ #
    #  Logout                                                              #
    # ------------------------------------------------------------------ #

    async def logout(
        self,
        user_id: str,
        access_jti: str,
        access_exp: int,
        raw_refresh_token: str | None,
    ) -> None:
        """Blacklist access token JTI + revoke refresh token family."""
        # 1. Blacklist access token (non-fatal if Redis down)
        try:
            await blacklist_token(self.redis, access_jti, access_exp)
        except Exception as exc:
            logger.warning("blacklist_token_failed", user_id=user_id, error=str(exc))

        # 2. Revoke refresh token family (if token provided)
        if raw_refresh_token:
            token_hash = hash_refresh_token(raw_refresh_token)
            record = await self.db.scalar(
                select(RefreshToken).where(RefreshToken.token_hash == token_hash)
            )
            if record:
                await self._revoke_family(record.family_id)

        logger.info("logout_completed", user_id=user_id)

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    async def _store_otp(self, email: str) -> str:
        """Generate 6-digit OTP, store sha256 in Redis. Falls back to in-memory in dev."""
        otp_code = str(secrets.randbelow(1_000_000)).zfill(6)
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        try:
            await self.redis.setex(f"otp:{email}", _OTP_TTL, otp_hash)
        except Exception as exc:
            if settings.ENVIRONMENT == "production":
                raise ZovuAPIError(
                    status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                    code="SERVICE_UNAVAILABLE",
                    message="Email verification service temporarily unavailable",
                )
            logger.warning("redis_unavailable_using_memory_store", email=email, error=str(exc))
            _dev_otp_store[email] = otp_hash
        return otp_code

    async def _check_otp_attempts(self, email: str) -> None:
        """Raise 429 if OTP attempts exceeded."""
        try:
            attempts_raw = await self.redis.get(f"otp:attempts:{email}")
            attempts = int(attempts_raw) if attempts_raw else 0
        except Exception:
            attempts = 0  # Can't check in dev without Redis
        if attempts >= _OTP_MAX_ATTEMPTS:
            raise ZovuAPIError(
                status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                code="TOO_MANY_ATTEMPTS",
                message="Too many incorrect OTP attempts. Please request a new OTP.",
            )

    async def _send_otp_email(self, user: User, otp_code: str) -> None:
        """Send OTP email (non-fatal — log on failure)."""
        try:
            from src.services.email_service import EmailService
            svc = EmailService()
            await svc.send_otp(
                to_email=user.email,
                otp=otp_code,
                user_name=_display_name(user),
            )
        except Exception as exc:
            logger.warning("otp_email_failed", user_id=user.id, error=str(exc))

    async def _provision_squad(self, user: User) -> None:
        """
        Attempt Squad VA creation. On failure: queue Celery retry, do NOT raise.
        """
        try:
            import httpx
            from src.services.squad import SquadService
            async with httpx.AsyncClient(timeout=30.0) as http:
                squad = SquadService(http=http, db=self.db, redis=self.redis)
                await squad.create_virtual_account(user)
        except Exception as exc:
            logger.error(
                "squad_provisioning_failed_queueing_retry",
                user_id=user.id,
                error=str(exc),
            )
            user.squad_provisioned = False
            await self.db.commit()
            # Queue Celery retry
            try:
                from src.workers.squad_tasks import retry_squad_provisioning
                retry_squad_provisioning.apply_async(
                    args=[user.id],
                    queue="critical",
                    countdown=10,
                )
            except Exception as celery_exc:
                logger.error("celery_queue_failed", user_id=user.id, error=str(celery_exc))

    async def _generate_tokens(
        self,
        user: User,
        family_id: str | None = None,
    ) -> dict:
        """
        Issue access token (JWT RS256) + opaque refresh token.
        Stores refresh token hash in DB.
        Returns dict for route to use (route sets cookie).
        """
        access_jti = str(uuid.uuid4())
        new_family_id = family_id or str(uuid.uuid4())

        # Access token (JWT RS256, 15-min TTL)
        access_token = create_access_token(user.id, user.role or "user", access_jti)

        # Opaque refresh token
        raw_refresh = secrets.token_urlsafe(64)
        refresh_hash = hash_refresh_token(raw_refresh)
        refresh_exp = _utcnow() + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)

        token_record = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            family_id=new_family_id,
            is_revoked=False,
            expires_at=refresh_exp,
        )
        self.db.add(token_record)
        await self.db.commit()

        logger.info(
            "tokens_issued",
            user_id=user.id,
            family_id=new_family_id,
            access_ttl=settings.JWT_ACCESS_TTL_MINUTES * 60,
        )

        return {
            "access_token": access_token,
            "refresh_token": raw_refresh,   # route sets this as httpOnly cookie
            "expires_in": settings.JWT_ACCESS_TTL_MINUTES * 60,
            "user": user,
        }

    async def _revoke_family(self, family_id: str) -> None:
        """Mark all tokens in a family as revoked."""
        records = (
            await self.db.scalars(
                select(RefreshToken).where(RefreshToken.family_id == family_id)
            )
        ).all()
        for r in records:
            r.is_revoked = True
        await self.db.commit()
        logger.info("token_family_revoked", family_id=family_id)
