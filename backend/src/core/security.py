"""
Security utilities: Argon2id hashing, RS256 JWT, Fernet PII encryption.
"""
from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerifyMismatchError,
    VerificationError,
)
from cryptography.fernet import Fernet
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from src.config import settings
from typing import Optional
import structlog

logger = structlog.get_logger()

# Argon2id configuration (OWASP minimums)
argon2_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64MB
    parallelism=2,
)

# Fernet cipher for PII encryption (only initialised if key is configured)
fernet_cipher = Fernet(settings.FIELD_ENCRYPTION_KEY.encode()) if settings.FIELD_ENCRYPTION_KEY else None


def hash_password(password: str) -> str:
    """Hash password using Argon2id (memory-hard, GPU-resistant)."""
    return argon2_hasher.hash(password)


def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against Argon2id hash."""
    try:
        argon2_hasher.verify(hash_value, password)
        return True
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def create_access_token(user_id: str, role: str, jti: str) -> str:
    """
    Create JWT access token (RS256, 15min TTL).
    jti (JWT ID) is used for token blacklisting.
    """
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TTL_MINUTES)
    payload = {
        "sub": user_id,
        "role": role,
        "jti": jti,
        "exp": exp,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(
        payload,
        settings.JWT_PRIVATE_KEY,
        algorithm="RS256",
    )


def verify_access_token(token: str) -> Optional[dict]:
    """Verify and decode JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_PUBLIC_KEY,
            algorithms=["RS256"],
        )
        return payload
    except JWTError as e:
        logger.warning("jwt_verification_failed", error=str(e))
        return None


def encrypt_pii(plaintext: str) -> bytes:
    """Encrypt PII (phone, BVN, NIN) using Fernet."""
    if not fernet_cipher:
        raise RuntimeError("FIELD_ENCRYPTION_KEY not configured")
    return fernet_cipher.encrypt(plaintext.encode())


def decrypt_pii(ciphertext: bytes) -> str:
    """Decrypt PII using Fernet."""
    if not fernet_cipher:
        raise RuntimeError("FIELD_ENCRYPTION_KEY not configured")
    return fernet_cipher.decrypt(ciphertext).decode()


def hash_refresh_token(token: str) -> str:
    """
    Hash refresh token for secure storage (never store raw token in DB).
    Uses SHA256 via cryptography module.
    """
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.backends import default_backend
    import hashlib
    
    return hashlib.sha256(token.encode()).hexdigest()


def verify_refresh_token_hash(token: str, stored_hash: str) -> bool:
    """Verify refresh token against stored hash."""
    return hash_refresh_token(token) == stored_hash


async def blacklist_token(redis, jti: str, exp: int) -> None:
    """Blacklist an access token JTI until its natural expiry."""
    import time
    ttl = max(int(exp - time.time()), 1)
    await redis.setex(f"blacklist:{jti}", ttl, "1")


async def is_token_blacklisted(redis, jti: str) -> bool:
    """Check if a token JTI is blacklisted."""
    return bool(await redis.exists(f"blacklist:{jti}"))


def validate_password_strength(password: str) -> None:
    """
    Enforce password policy: 8+ chars, upper, lower, digit, special char.
    Raises ValueError with a descriptive message on failure.
    """
    import re
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must contain at least one special character")
