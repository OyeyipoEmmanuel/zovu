"""
Middleware for CORS, structured logging, request tracing, and error handling.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from src.config import settings
from src.core.exceptions import ZovuException, ZovuAPIError
import structlog
import uuid
from typing import Callable

logger = structlog.get_logger()


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for structured logging with request/trace IDs."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Callable:
        # Honour incoming X-Request-ID for distributed tracing; otherwise generate.
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        trace_id = request.headers.get("X-Trace-ID", request_id)
        user_id = request.headers.get("X-User-ID", "anonymous")

        # Make the id reachable from FastAPI exception handlers via request.state
        request.state.request_id = request_id
        request.state.trace_id = trace_id

        # Bind context to structlog so every log line in this request carries the id
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
    """Middleware to catch and format all exceptions in the standard envelope."""

    async def dispatch(self, request: Request, call_next: Callable) -> Callable:
        request_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())
        try:
            return await call_next(request)
        except ZovuAPIError as exc:
            logger.warning(
                "api_error",
                code=exc.error_code,
                status_code=exc.status_code,
                field=exc.error_field,
                request_id=request_id,
            )
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "ok": False,
                    "error": {
                        "code": exc.error_code,
                        "message": exc.detail,
                        "field": exc.error_field,
                    },
                    "request_id": request_id,
                },
            )
        except ZovuException as exc:
            logger.warning("zovu_exception", status_code=exc.status_code, detail=exc.detail, request_id=request_id)
            # Normalize to standard envelope so the frontend never sees a bare `detail`.
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "ok": False,
                    "error": {
                        "code": "ZOVU_ERROR",
                        "message": exc.detail,
                        "field": None,
                    },
                    "request_id": request_id,
                },
            )
        except Exception as exc:
            logger.error("unhandled_exception", error=str(exc), request_id=request_id, exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "ok": False,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "An unexpected error occurred. Please try again.",
                        "field": None,
                    },
                    "request_id": request_id,
                },
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
