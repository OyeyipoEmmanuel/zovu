"""
Pydantic Settings for configuration management.
ALL environment variables are validated at startup — app refuses to start if any are missing.
"""
from pydantic_settings import BaseSettings
from typing import List


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
    
    # Celery
    CELERY_BROKER_URL: str = ""  # Falls back to REDIS_URL/db2 if empty
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated origins into list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
