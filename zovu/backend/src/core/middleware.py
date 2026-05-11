"""
Middleware for CORS, structured logging, request tracing, and error handling.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from src.config import settings
from src.core.exceptions import ZovuException
import structlog
import uuid
from typing import Callable

logger = structlog.get_logger()


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for structured logging with request/trace IDs."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Callable:
        # Generate request ID and trace ID
        request_id = str(uuid.uuid4())
        trace_id = request.headers.get("X-Trace-ID", request_id)
        user_id = request.headers.get("X-User-ID", "anonymous")
        
        # Bind context to structlog
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            trace_id=trace_id,
            user_id=user_id,
            method=request.method,
            path=request.url.path,
        )
        
        logger.info("request_started")
        
        try:
            response = await call_next(request)
            logger.info("request_completed", status_code=response.status_code)
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Trace-ID"] = trace_id
            return response
        except Exception as exc:
            logger.error("request_failed", error=str(exc), exc_info=True)
            raise


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware to catch and format all exceptions."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Callable:
        try:
            return await call_next(request)
        except ZovuException as exc:
            logger.warning("zovu_exception", status_code=exc.status_code, detail=exc.detail)
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
            )
        except Exception as exc:
            logger.error("unhandled_exception", error=str(exc), exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )


def add_middleware(app):
    """Add all middleware to FastAPI app."""
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Trace-ID"],
    )
    
    # Error handling
    app.add_middleware(ErrorHandlerMiddleware)
    
    # Structured logging
    app.add_middleware(StructuredLoggingMiddleware)
