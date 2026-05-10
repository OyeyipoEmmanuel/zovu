"""
Webhooks router — Squad webhook receiver with idempotency and signature verification.
CRITICAL: Verify HMAC-SHA512 signature + check Redis idempotency before processing.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from src.core.database import get_db
from src.core.redis_client import get_redis_cache
from src.services.squad import SquadService
from src.core.exceptions import ValidationError
import structlog
import json

logger = structlog.get_logger()

router = APIRouter()


@router.post(
    "/squad",
    response_model=dict,
    tags=["Webhooks"],
    summary="Squad Webhook",
    description="Receive Squad webhook events (idempotent)",
)
async def squad_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_cache),
    x_squadco_signature: str = Header(None),
):
    """
    Receive Squad webhook events.
    
    **CRITICAL SECURITY**:
    1. Verifies HMAC-SHA512 signature using Squad secret key
    2. Checks Redis idempotency (nx=True atomic set, 24hr expiry)
    3. Processes asynchronously via Celery (returns immediately)
    
    Expected headers:
    - **X-SquadCo-Signature**: HMAC-SHA512 signature
    
    Webhook is idempotent — retries with same webhook_id are safe.
    Processing happens asynchronously; endpoint returns 202 Accepted.
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        if not x_squadco_signature:
            logger.warning("webhook_missing_signature")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")
        
        # Verify signature
        squad_service = SquadService(db, redis)
        is_valid = await squad_service.verify_webhook_signature(body, x_squadco_signature)
        
        if not is_valid:
            logger.error("webhook_signature_verification_failed")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
        
        # Parse JSON
        webhook_data = json.loads(body.decode())
        
        # Handle webhook (with idempotency)
        result = await squad_service.handle_webhook(webhook_data)
        
        logger.info("webhook_received_and_queued", webhook_id=webhook_data.get("id"))
        
        return {
            "status": "accepted",
            "webhook_id": webhook_data.get("id"),
            "message": "Webhook received and queued for processing",
        }
    
    except ValidationError as e:
        # Already processed (idempotency check)
        logger.info("webhook_already_processed")
        return {
            "status": "accepted",
            "message": "Webhook already processed",
        }
    
    except Exception as e:
        logger.error("webhook_processing_failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Webhook processing failed")
