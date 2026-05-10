"""
FastAPI application factory with lifespan context manager.
"""
# pyrefly: ignore [missing-import]
from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.config import settings
from src.core.database import init_db, close_db
from src.core.redis_client import close_redis
from src.core.middleware import add_middleware
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
    
    # Test Redis connection
    try:
        from src.core.redis_client import redis_client
        redis = await redis_client.get_pool(0)
        await redis.ping()
        logger.info("redis_connected")
    except Exception as e:
        logger.error("redis_connection_failed", error=str(e), exc_info=True)
        raise
    
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
        loans_router,
        transactions_router,
        ajo_router,
        referral_router,
        webhooks_router,
    )
    
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
    app.include_router(credit_router, prefix="/api/v1/credit", tags=["Credit"])
    app.include_router(loans_router, prefix="/api/v1/loans", tags=["Loans"])
    app.include_router(transactions_router, prefix="/api/v1/transactions", tags=["Transactions"])
    app.include_router(ajo_router, prefix="/api/v1/ajo", tags=["Ajo"])
    app.include_router(referral_router, prefix="/api/v1/referral", tags=["Referral"])
    app.include_router(webhooks_router, prefix="/api/v1/webhooks", tags=["Webhooks"])
    
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
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
    )
