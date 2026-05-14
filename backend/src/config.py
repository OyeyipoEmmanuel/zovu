"""
Pydantic Settings for configuration management.
ALL environment variables are validated at startup — app refuses to start if any are missing.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
from urllib.parse import urlparse, urlunparse


def redis_url_with_database(redis_url: str, database: int) -> str:
    """Build a Redis URL with DB in the path (redis-py 4+ / Celery compatible)."""
    p = urlparse(redis_url.strip())
    return urlunparse((p.scheme, p.netloc, f"/{database}", "", p.query, p.fragment))


class Settings(BaseSettings):
    """Central configuration — all required vars must be present or app crashes."""
    
    # Database
    DATABASE_URL: str  # postgresql+asyncpg://user:password@host:5432/zovu
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str  # redis://localhost:6379 or rediss://... (TLS) in prod
    
    # JWT Configuration (RS256 asymmetric)
    JWT_PRIVATE_KEY: str  # PEM format — generated via openssl genrsa
    JWT_PUBLIC_KEY: str   # PEM format — generated via openssl rsa -pubout
    JWT_ACCESS_TTL_MINUTES: int = 15
    JWT_REFRESH_TTL_DAYS: int = 7
    
    # Squad API Configuration
    SQUAD_SECRET_KEY: str
    SQUAD_PUBLIC_KEY: str = ""   # Used for checkout initiation
    SQUAD_BASE_URL: str  # https://sandbox-api-d.squadco.com (dev) or https://api-d.squadco.com (prod)
    SQUAD_WEBHOOK_IP: str = ""  # Optional IP whitelist for Squad webhooks
    
    # External APIs (optional — warn at startup if missing)
    OPENAI_API_KEY: str = ""      # For Whisper voice transcription
    ANTHROPIC_API_KEY: str = ""   # For Claude NLP extraction
    COHERE_API_KEY: str = ""      # For multilingual embeddings
    
    # Encryption (PII at rest)
    FIELD_ENCRYPTION_KEY: str = ""  # Fernet key: 32-byte url-safe base64

    @field_validator("FIELD_ENCRYPTION_KEY", mode="before")
    @classmethod
    def ensure_encryption_key(cls, v):
        if not v:
            import os as _os
            if _os.environ.get("ENVIRONMENT", "development") == "development":
                from cryptography.fernet import Fernet
                import structlog as _structlog
                key = Fernet.generate_key().decode()
                _structlog.get_logger().warning(
                    "encryption_key_auto_generated",
                    hint="Set FIELD_ENCRYPTION_KEY in .env for persistence"
                )
                return key
            raise ValueError(
                "FIELD_ENCRYPTION_KEY is required in production. "
                "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        return v
    
    # Application
    PORT: int = 4000
    ENVIRONMENT: str = "development"  # development | production
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174"  # comma-separated
    SENTRY_DSN: str = ""
    
    # Email
    EMAIL_PROVIDER: str = "smtp"   # smtp | sendgrid
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@zovu.app"
    FROM_NAME: str = "Zovu"
    SENDGRID_API_KEY: str = ""
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Celery: broker always follows REDIS_URL (DB /2). Legacy env key kept for .env compatibility (ignored).
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated origins into list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def celery_broker_url_resolved(self) -> str:
        """Broker always follows REDIS_URL (DB /2) so Docker hostname redis resolves correctly."""
        return redis_url_with_database(self.REDIS_URL, 2)

    @property
    def celery_result_backend_resolved(self) -> str:
        if self.CELERY_RESULT_BACKEND.strip():
            return self.CELERY_RESULT_BACKEND.strip()
        return self.celery_broker_url_resolved


settings = Settings()
