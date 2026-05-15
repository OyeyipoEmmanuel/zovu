"""
FastAPI application factory with lifespan context manager.
"""
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from src.config import settings
from src.core.database import init_db, close_db
from src.core.seeder import run_seeder
from src.core.redis_client import close_redis
from src.core.middleware import add_middleware
from src.core.exceptions import ZovuAPIError
# pyrefly: ignore [missing-import]
import structlog
# pyrefly: ignore [missing-import]
import sentry_sdk
# pyrefly: ignore [missing-import]
from prometheus_fastapi_instrumentator import Instrumentator

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown.
    """
    # ===== STARTUP =====
    logger.info("application_startup", environment=settings.ENVIRONMENT)

    # Initialize database
    try:
        await init_db()
        logger.info("database_initialized")
    except Exception as e:
        logger.error("database_initialization_failed", error=str(e), exc_info=True)
        raise

    # Seed database from CSV files (no-op if data already exists; never aborts startup)
    await run_seeder()

    # Test Redis connection (non-fatal in development)
    try:
        from src.core.redis_client import redis_client
        redis = await redis_client.get_pool(0)
        await redis.ping()
        logger.info("redis_connected")
    except Exception as e:
        logger.error("redis_required", error=str(e))
        raise RuntimeError(
            f"Redis is required for authentication and sessions. "
            f"Start Redis and set REDIS_URL. Error: {e}"
        )
    
    # Test external APIs are configured
    if not settings.OPENAI_API_KEY:
        logger.warning("openai_not_configured")
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("anthropic_not_configured")
    if not settings.COHERE_API_KEY:
        logger.warning("cohere_not_configured")
    
    yield
    
    # ===== SHUTDOWN =====
    logger.info("application_shutdown")
    
    # Close Redis
    try:
        await close_redis()
        logger.info("redis_closed")
    except Exception as e:
        logger.error("redis_close_failed", error=str(e))
    
    # Close database
    try:
        await close_db()
        logger.info("database_closed")
    except Exception as e:
        logger.error("database_close_failed", error=str(e))


def create_app() -> FastAPI:
    """
    Create and configure FastAPI application.
    """
    # Initialize Sentry (if configured)
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=1.0 if settings.DEBUG else 0.1,
        )
        logger.info("sentry_initialized")
    
    # Create app
    app = FastAPI(
        title="Zovu Backend",
        description="Credit and savings platform API",
        version="1.0.0",
        lifespan=lifespan,
    )
    
    # Add middleware
    add_middleware(app)

    def _request_id(request: Request) -> str:
        import uuid as _uuid
        rid = getattr(request.state, "request_id", None)
        return rid or str(_uuid.uuid4())

    # ZovuAPIError → envelope format
    @app.exception_handler(ZovuAPIError)
    async def zovu_api_error_handler(request: Request, exc: ZovuAPIError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "ok": False,
                "error": {
                    "code": exc.error_code,
                    "message": exc.detail,
                    "field": exc.error_field,
                },
                "request_id": _request_id(request),
            },
        )

    # Pydantic validation errors → envelope format
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        first = errors[0] if errors else {}
        field = ".".join(str(l) for l in first.get("loc", [])[1:]) or None
        return JSONResponse(
            status_code=422,
            content={
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": first.get("msg", "Validation error"),
                    "field": field,
                },
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id(request)
        logger.error(
            "unhandled_exception",
            error=str(exc),
            path=str(request.url),
            request_id=request_id,
            exc_info=True,
        )
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

    # Add Prometheus instrumentation
    Instrumentator().instrument(app).expose(app)
    
    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health():
        """Health check endpoint."""
        return {
            "status": "ok",
            "environment": settings.ENVIRONMENT,
        }
    
    # Ready check endpoint (all dependencies loaded)
    @app.get("/ready", tags=["Health"])
    async def ready():
        """Readiness check endpoint."""
        return {
            "status": "ready",
            "environment": settings.ENVIRONMENT,
        }
    
    # Include routers
    from src.routers import (
        auth_router,
        credit_router,
        gigs_router,
        lenders_router,
        job_seekers_router,
        loans_router,
        transactions_router,
        ajo_router,
        referral_router,
        webhooks_router,
        admin_router,
    )
    
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
    app.include_router(credit_router, prefix="/api/v1")
    app.include_router(gigs_router, prefix="/api/v1")
    app.include_router(lenders_router, prefix="/api/v1")
    app.include_router(job_seekers_router, prefix="/api/v1")
    app.include_router(loans_router, prefix="/api/v1/loans", tags=["Loans"])
    app.include_router(transactions_router, prefix="/api/v1/transactions", tags=["Transactions"])
    app.include_router(ajo_router, prefix="/api/v1/ajo", tags=["Ajo"])
    app.include_router(referral_router, prefix="/api/v1/referral", tags=["Referral"])
    app.include_router(webhooks_router, prefix="/api/v1/webhooks", tags=["Webhooks"])
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
    
    logger.info("application_created", routes=len(app.routes))
    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=4000,
        reload=settings.DEBUG,
        log_level="info",
    )
