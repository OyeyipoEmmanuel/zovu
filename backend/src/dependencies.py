"""
Dependency injection for database, Redis, authentication, and authorization.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from src.core.database import async_session
from src.core.redis_client import (
    get_redis_blacklist,
    get_redis_cache,
    get_redis_db,
)
from src.core.security import verify_access_token
from src.core.exceptions import AuthenticationError, AuthorizationError
from src.models import User, UserRole
from fastapi import Header, Cookie
from typing import Optional
import structlog

logger = structlog.get_logger()


async def get_db() -> AsyncSession:
    """Get database session."""
    async with async_session() as session:
        yield session


async def get_redis_cache_dep() -> Redis:
    """Get cache Redis client."""
    return await get_redis_cache()


async def get_redis_blacklist_dep() -> Redis:
    """Get blacklist Redis client."""
    return await get_redis_blacklist()


async def get_token_from_header(
    authorization: Optional[str] = Header(None),
) -> str:
    """Extract bearer token from Authorization header."""
    if not authorization:
        raise AuthenticationError("Missing Authorization header")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError("Invalid Authorization header format")
    
    return parts[1]


async def get_current_user(
    token: str = Depends(get_token_from_header),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
) -> User:
    """
    Get current authenticated user.
    CRITICAL: Check token blacklist for revocation + logout.
    """
    # Verify token
    payload = verify_access_token(token)
    if not payload:
        raise AuthenticationError("Invalid or expired token")
    
    user_id = payload.get("sub")
    jti = payload.get("jti")
    
    if not user_id or not jti:
        raise AuthenticationError("Invalid token structure")
    
    # Check blacklist (logout + revocation)
    is_blacklisted = await redis.exists(f"blacklist:{jti}")
    if is_blacklisted:
        logger.warning("token_blacklisted", user_id=user_id, jti=jti)
        raise AuthenticationError("Token has been revoked")
    
    # Get user from database
    from sqlalchemy import select
    
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if not user:
        logger.warning("user_not_found", user_id=user_id)
        raise AuthenticationError("User not found")
    
    if user.status == "frozen":
        logger.warning("user_frozen", user_id=user_id)
        raise AuthenticationError("Account is frozen")
    
    return user


async def require_role(
    required_role: UserRole,
):
    """Dependency factory for role-based authorization."""
    async def check_role(user: User = Depends(get_current_user)) -> User:
        if user.role != required_role:
            logger.warning(
                "authorization_failed",
                user_id=user.id,
                required_role=required_role,
                user_role=user.role,
            )
            raise AuthorizationError("Insufficient permissions")
        return user
    
    return check_role


def require_admin():
    """Dependency for admin-only endpoints."""
    return require_role(UserRole.ADMIN)


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_blacklist_dep),
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise None.
    For endpoints that work with or without auth.
    """
    if not authorization:
        return None
    
    try:
        token = authorization.split()[1] if " " in authorization else None
        if not token:
            return None
        
        payload = verify_access_token(token)
        if not payload:
            return None
        
        user_id = payload.get("sub")
        jti = payload.get("jti")
        
        # Check blacklist
        is_blacklisted = await redis.exists(f"blacklist:{jti}")
        if is_blacklisted:
            return None
        
        # Get user
        from sqlalchemy import select
        
        query = select(User).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        
        return user
    except Exception as e:
        logger.warning("optional_auth_failed", error=str(e))
        return None
