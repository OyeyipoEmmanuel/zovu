"""
Authentication service — OTP flow, registration, login, refresh, logout.
All tokens are JWT (RS256). Refresh tokens are family-rotated for security.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models import User, OTP, RefreshToken, UserRole, UserStatus
from src.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
    hash_refresh_token,
)
from src.core.exceptions import (
    AuthenticationError,
    ValidationError,
    ConflictError,
    NotFoundError,
)
from src.config import settings
import structlog
import uuid
from datetime import datetime, timedelta, timezone
from redis.asyncio import Redis
import secrets
import hashlib

logger = structlog.get_logger()


class AuthService:
    """Authentication service with OTP, registration, login, token rotation."""
    
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis
    
    async def send_otp(self, email: str) -> dict:
        """
        Send OTP to email for login or registration.
        Stores hashed OTP in database with 10-minute expiry.
        
        Args:
            email: User email address
            
        Returns:
            dict with email and message
            
        Raises:
            ValidationError: If email is invalid
        """
        email = email.lower().strip()
        logger.info("otp_request", email=email)
        
        # Generate 6-digit OTP
        otp_code = secrets.randbelow(999999)
        otp_code_str = str(otp_code).zfill(6)
        otp_hash = hashlib.sha256(otp_code_str.encode()).hexdigest()
        
        # Check if user exists
        query = select(User).where(User.email == email)
        result = await self.db.execute(query)
        existing_user = result.scalar_one_or_none()
        
        # Delete any existing OTP for this email
        query = select(OTP).where(OTP.user_id == (existing_user.id if existing_user else None))
        result = await self.db.execute(query)
        old_otps = result.scalars().all()
        for old_otp in old_otps:
            await self.db.delete(old_otp)
        await self.db.commit()
        
        # Create new OTP
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        if existing_user:
            otp = OTP(
                user_id=existing_user.id,
                code_hash=otp_hash,
                purpose="login",
                expires_at=expires_at,
                max_attempts=3,
            )
        else:
            # Temporary placeholder user for registration flow
            temp_user = User(
                id=str(uuid.uuid4()),
                email=email,
                password_hash="temp",  # Will be updated on registration
                phone=b"temp",  # Placeholder encrypted value
            )
            self.db.add(temp_user)
            await self.db.flush()
            
            otp = OTP(
                user_id=temp_user.id,
                code_hash=otp_hash,
                purpose="registration",
                expires_at=expires_at,
                max_attempts=3,
            )
        
        self.db.add(otp)
        await self.db.commit()
        
        # TODO: Send OTP via email (integrate email service)
        # For now, log it for development
        logger.info("otp_generated", email=email, code=otp_code_str)
        
        return {
            "email": email,
            "message": "OTP sent to email",
            # REMOVE IN PRODUCTION: only for testing
            "otp": otp_code_str if settings.DEBUG else None,
        }
    
    async def verify_otp_and_register(
        self,
        email: str,
        otp_code: str,
        password: str,
    ) -> dict:
        """
        Verify OTP and register/update user account.
        
        Args:
            email: User email
            otp_code: 6-digit OTP
            password: User password (8+ chars, will be hashed)
            
        Returns:
            dict with access_token, refresh_token, expires_in
            
        Raises:
            ValidationError: If OTP invalid, expired, or max attempts exceeded
            AuthenticationError: If registration fails
        """
        email = email.lower().strip()
        logger.info("otp_verification_started", email=email)
        
        # Validate password
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters")
        
        # Find user by email
        query = select(User).where(User.email == email)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning("user_not_found_for_otp", email=email)
            raise NotFoundError("User not found")
        
        # Get latest OTP
        query = select(OTP).where(OTP.user_id == user.id).order_by(OTP.created_at.desc())
        result = await self.db.execute(query)
        otp_record = result.scalar_one_or_none()
        
        if not otp_record:
            raise ValidationError("No OTP found")
        
        # Check expiry
        if otp_record.expires_at < datetime.now(timezone.utc):
            logger.warning("otp_expired", email=email)
            await self.db.delete(otp_record)
            await self.db.commit()
            raise ValidationError("OTP expired")
        
        # Check max attempts
        if otp_record.attempts >= otp_record.max_attempts:
            logger.warning("otp_max_attempts_exceeded", email=email)
            await self.db.delete(otp_record)
            await self.db.commit()
            raise ValidationError("Too many OTP attempts")
        
        # Verify OTP
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        if otp_hash != otp_record.code_hash:
            otp_record.attempts += 1
            await self.db.commit()
            logger.warning("otp_verification_failed", email=email, attempts=otp_record.attempts)
            raise ValidationError("Invalid OTP")
        
        # Update user password and mark OTP used
        user.password_hash = hash_password(password)
        user.status = UserStatus.ACTIVE
        otp_record.used = True
        otp_record.used_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        logger.info("user_registered", user_id=user.id, email=email)
        
        # Generate tokens
        return await self._generate_tokens(user.id, user.role)
    
    async def login(self, email: str, password: str) -> dict:
        """
        Login with email and password.
        
        Args:
            email: User email
            password: User password
            
        Returns:
            dict with access_token, refresh_token, expires_in
            
        Raises:
            AuthenticationError: If credentials invalid or user frozen
        """
        email = email.lower().strip()
        logger.info("login_attempt", email=email)
        
        # Find user
        query = select(User).where(User.email == email)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning("login_user_not_found", email=email)
            raise AuthenticationError("Invalid credentials")
        
        # Check frozen status
        if user.status == UserStatus.SOFT_FROZEN:
            logger.warning("login_user_frozen", user_id=user.id, email=email)
            raise AuthenticationError("Account is frozen")
        
        # Verify password
        if not verify_password(password, user.password_hash):
            logger.warning("login_password_mismatch", user_id=user.id, email=email)
            raise AuthenticationError("Invalid credentials")
        
        logger.info("login_successful", user_id=user.id, email=email)
        return await self._generate_tokens(user.id, user.role)
    
    async def refresh_access_token(self, refresh_token: str) -> dict:
        """
        Refresh access token using refresh token.
        Implements family-based rotation: revokes old token family, issues new family.
        
        Args:
            refresh_token: JWT refresh token
            
        Returns:
            dict with new access_token, refresh_token, expires_in
            
        Raises:
            AuthenticationError: If refresh token invalid or revoked
        """
        logger.info("refresh_token_attempt")
        
        # Verify refresh token JWT
        payload = verify_access_token(refresh_token)
        if not payload:
            logger.warning("refresh_token_verification_failed")
            raise AuthenticationError("Invalid refresh token")
        
        user_id = payload.get("sub")
        jti = payload.get("jti")
        
        # Check if refresh token is blacklisted
        is_blacklisted = await self.redis.exists(f"blacklist:{jti}")
        if is_blacklisted:
            logger.warning("refresh_token_blacklisted", user_id=user_id)
            raise AuthenticationError("Refresh token revoked")
        
        # Get user
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning("refresh_token_user_not_found", user_id=user_id)
            raise AuthenticationError("User not found")
        
        # Get refresh token record (for family rotation)
        token_hash = hash_refresh_token(refresh_token)
        query = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        result = await self.db.execute(query)
        refresh_token_record = result.scalar_one_or_none()
        
        if not refresh_token_record or refresh_token_record.is_revoked:
            logger.warning("refresh_token_record_revoked", user_id=user_id)
            raise AuthenticationError("Refresh token revoked")
        
        # Check expiry
        if refresh_token_record.expires_at < datetime.now(timezone.utc):
            logger.warning("refresh_token_expired", user_id=user_id)
            raise AuthenticationError("Refresh token expired")
        
        # FAMILY-BASED ROTATION: Revoke all tokens in same family
        family_id = refresh_token_record.family_id
        query = select(RefreshToken).where(RefreshToken.family_id == family_id)
        result = await self.db.execute(query)
        old_tokens = result.scalars().all()
        
        for old_token in old_tokens:
            old_token.is_revoked = True
            # Also blacklist via Redis for immediate effect
            await self.redis.setex(f"blacklist:{old_token.id}", 604800, "1")  # 7 days
        
        await self.db.commit()
        logger.info("token_family_rotated", user_id=user_id, family_id=family_id)
        
        # Generate new tokens with NEW family
        return await self._generate_tokens(user.id, user.role)
    
    async def logout(self, user_id: str, refresh_token: str) -> dict:
        """
        Logout user by blacklisting all tokens in family.
        
        Args:
            user_id: User ID
            refresh_token: Refresh token to revoke
            
        Returns:
            dict with status
        """
        logger.info("logout_started", user_id=user_id)
        
        try:
            # Verify user exists
            query = select(User).where(User.id == user_id)
            result = await self.db.execute(query)
            user = result.scalar_one_or_none()
            
            if not user:
                logger.warning("logout_user_not_found", user_id=user_id)
                raise AuthenticationError("User not found")
            
            # Get refresh token record
            token_hash = hash_refresh_token(refresh_token)
            query = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
            result = await self.db.execute(query)
            refresh_token_record = result.scalar_one_or_none()
            
            if refresh_token_record:
                # Revoke entire family
                family_id = refresh_token_record.family_id
                query = select(RefreshToken).where(RefreshToken.family_id == family_id)
                result = await self.db.execute(query)
                tokens_to_revoke = result.scalars().all()
                
                for token in tokens_to_revoke:
                    token.is_revoked = True
                    # Blacklist immediately
                    await self.redis.setex(f"blacklist:{token.id}", 604800, "1")
                
                await self.db.commit()
                logger.info("logout_successful", user_id=user_id, family_id=family_id)
            
            return {"status": "logged out"}
        except Exception as e:
            logger.error("logout_failed", user_id=user_id, error=str(e))
            raise
    
    async def _generate_tokens(self, user_id: str, role: UserRole) -> dict:
        """
        Generate new access and refresh token pair.
        
        Args:
            user_id: User ID
            role: User role
            
        Returns:
            dict with access_token, refresh_token, expires_in
        """
        # Generate JTIs (JWT IDs) for token tracking
        access_jti = str(uuid.uuid4())
        refresh_jti = str(uuid.uuid4())
        family_id = str(uuid.uuid4())  # Family ID for rotation tracking
        
        # Create access token
        access_token = create_access_token(user_id, role, access_jti)
        
        # Create refresh token (also JWT but with longer TTL)
        from src.core.security import jwt as jose_jwt
        refresh_exp = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
        refresh_payload = {
            "sub": user_id,
            "jti": refresh_jti,
            "exp": refresh_exp,
            "iat": datetime.now(timezone.utc),
        }
        refresh_token = jose_jwt.encode(
            refresh_payload,
            settings.JWT_PRIVATE_KEY,
            algorithm="RS256",
        )
        
        # Store refresh token hash in database (never store raw token)
        refresh_token_hash = hash_refresh_token(refresh_token)
        refresh_token_record = RefreshToken(
            user_id=user_id,
            token_hash=refresh_token_hash,
            family_id=family_id,
            is_revoked=False,
            expires_at=refresh_exp,
        )
        self.db.add(refresh_token_record)
        await self.db.commit()
        
        logger.info(
            "tokens_generated",
            user_id=user_id,
            family_id=family_id,
            ttl_seconds=settings.JWT_ACCESS_TTL_MINUTES * 60,
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TTL_MINUTES * 60,
        }
