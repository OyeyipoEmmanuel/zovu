"""
Custom exception hierarchy for Zovu backend.
"""
from fastapi import HTTPException, status
from typing import Any, Optional


class ZovuException(HTTPException):
    """Base exception for all Zovu errors."""
    
    def __init__(
        self,
        status_code: int = 400,
        detail: str = "Bad Request",
        headers: Optional[dict] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)


class ValidationError(ZovuException):
    """Invalid input data."""
    
    def __init__(self, detail: str = "Validation failed"):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class AuthenticationError(ZovuException):
    """Invalid credentials or missing auth."""
    
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class AuthorizationError(ZovuException):
    """Insufficient permissions."""
    
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class NotFoundError(ZovuException):
    """Resource not found."""
    
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ConflictError(ZovuException):
    """Resource already exists or state conflict."""
    
    def __init__(self, detail: str = "Conflict"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class RateLimitExceededError(ZovuException):
    """Too many requests."""
    
    def __init__(self, detail: str = "Too many requests"):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)


class InternalServerError(ZovuException):
    """Unexpected server error."""
    
    def __init__(self, detail: str = "Internal server error"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


class ExternalServiceError(ZovuException):
    """External API failure (Squad, OpenAI, etc)."""
    
    def __init__(self, service: str, detail: str = "External service error"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{service}: {detail}",
        )


class TransactionError(ZovuException):
    """Transaction-related errors."""
    
    def __init__(self, detail: str = "Transaction failed"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class UserFrozenError(ZovuException):
    """User account is soft-frozen."""
    
    def __init__(self, detail: str = "Account frozen"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ZovuAPIError(ZovuException):
    """
    Structured API error that maps to the response envelope format:
    { "ok": false, "error": { "code": "...", "message": "...", "field": null } }
    """
    
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field: Optional[str] = None,
    ):
        self.error_code = code
        self.error_field = field
        super().__init__(status_code=status_code, detail=message)
