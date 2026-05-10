"""
Squad API integration service — virtual accounts, transfers, webhook handling.
HMAC-SHA512 verification for webhook security.
Idempotency via Redis atomic checks.
"""
from src.config import settings
from src.models import Transaction, TransactionType, SquadWebhookLog
from src.core.exceptions import ExternalServiceError, ValidationError
import structlog
import httpx
import hmac
import hashlib
import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis
import uuid

logger = structlog.get_logger()


class SquadService:
    """Squad API integration service."""
    
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis
        self.base_url = settings.SQUAD_BASE_URL
        self.secret_key = settings.SQUAD_SECRET_KEY
    
    async def create_virtual_account(self, user_id: str, email: str, phone: str) -> dict:
        """
        Create virtual account on Squad for user.
        Called once during KYC verification.
        
        Args:
            user_id: User ID
            email: User email
            phone: User phone (will be encrypted separately)
            
        Returns:
            dict with squad_id and account details
            
        Raises:
            ExternalServiceError: If Squad API call fails
        """
        logger.info("squad_virtual_account_creation", user_id=user_id, email=email)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/virtual-accounts",
                    json={
                        "business_name": "Zovu",
                        "customer_email": email,
                        "customer_phone": phone,
                        "is_individual": True,
                    },
                    headers=self._get_squad_headers(),
                    timeout=10,
                )
                
                if response.status_code not in [200, 201]:
                    logger.error("squad_virtual_account_failed", status=response.status_code)
                    raise ExternalServiceError("Squad", f"Failed to create virtual account")
                
                data = response.json()
                logger.info(
                    "squad_virtual_account_created",
                    user_id=user_id,
                    squad_id=data.get("id"),
                )
                
                return {
                    "squad_id": data.get("id"),
                    "account_number": data.get("account_number"),
                    "bank_name": data.get("bank_name"),
                }
        except httpx.RequestError as e:
            logger.error("squad_request_error", error=str(e))
            raise ExternalServiceError("Squad", "Network error")
    
    async def initiate_transfer(
        self,
        amount: int,
        recipient_account: str,
        recipient_bank_code: str,
        reference: str,
        narration: str = "Zovu transfer",
    ) -> dict:
        """
        Initiate transfer via Squad API.
        Amount in KOBO.
        
        Args:
            amount: Amount in KOBO
            recipient_account: Recipient bank account number
            recipient_bank_code: Recipient bank code
            reference: Transaction reference
            narration: Transaction narration
            
        Returns:
            dict with squad_transaction_id
            
        Raises:
            ExternalServiceError: If Squad API call fails
        """
        # Convert KOBO to NAIRA for Squad API
        amount_naira = amount / 100
        
        logger.info(
            "squad_transfer_initiated",
            amount=amount_naira,
            recipient_account=recipient_account,
            reference=reference,
        )
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/transfers",
                    json={
                        "amount": amount_naira,
                        "recipient_account": recipient_account,
                        "recipient_bank_code": recipient_bank_code,
                        "reference": reference,
                        "narration": narration,
                    },
                    headers=self._get_squad_headers(),
                    timeout=30,
                )
                
                if response.status_code not in [200, 201]:
                    logger.error(
                        "squad_transfer_failed",
                        status=response.status_code,
                        response=response.text,
                    )
                    raise ExternalServiceError("Squad", "Transfer initiation failed")
                
                data = response.json()
                logger.info(
                    "squad_transfer_successful",
                    squad_transaction_id=data.get("id"),
                )
                
                return {
                    "squad_transaction_id": data.get("id"),
                    "status": data.get("status"),
                }
        except httpx.RequestError as e:
            logger.error("squad_transfer_request_error", error=str(e))
            raise ExternalServiceError("Squad", "Network error")
    
    async def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify Squad webhook signature using HMAC-SHA512.
        CRITICAL: Must verify before processing webhook.
        
        Args:
            payload: Raw request body
            signature: X-SquadCo-Signature header value
            
        Returns:
            bool: True if signature valid
        """
        expected_signature = hmac.new(
            self.secret_key.encode(),
            payload,
            hashlib.sha512,
        ).hexdigest()
        
        is_valid = hmac.compare_digest(expected_signature, signature)
        
        if not is_valid:
            logger.warning("webhook_signature_verification_failed", signature=signature)
        else:
            logger.info("webhook_signature_verified")
        
        return is_valid
    
    async def handle_webhook(self, webhook_data: dict) -> dict:
        """
        Handle Squad webhook with idempotency.
        CRITICAL: Check idempotency via Redis atomic SET (nx=True).
        
        Args:
            webhook_data: Webhook payload
            
        Returns:
            dict with processing result
            
        Raises:
            ValidationError: If webhook already processed
        """
        webhook_id = webhook_data.get("id")
        event_type = webhook_data.get("event_type")
        
        if not webhook_id or not event_type:
            logger.warning("webhook_missing_fields")
            raise ValidationError("Missing webhook fields")
        
        logger.info("webhook_received", webhook_id=webhook_id, event_type=event_type)
        
        # IDEMPOTENCY CHECK: Atomic Redis SET with nx=True + 24hr expiry
        idempotency_key = f"squad_webhook:{webhook_id}"
        was_new = await self.redis.set(
            idempotency_key,
            "1",
            nx=True,  # Only set if not exists
            ex=86400,  # 24 hours
        )
        
        if not was_new:
            logger.info("webhook_already_processed", webhook_id=webhook_id)
            raise ValidationError("Webhook already processed")
        
        # Log webhook for audit trail
        webhook_log = SquadWebhookLog(
            webhook_id=webhook_id,
            event_type=event_type,
            payload=webhook_data,
            processed=False,
        )
        self.db.add(webhook_log)
        await self.db.commit()
        
        logger.info("webhook_logged", webhook_id=webhook_id)
        
        # Dispatch to async task (Celery) for actual processing
        # In production, this is where you'd call:
        # from src.workers.squad_tasks import process_squad_webhook_async
        # process_squad_webhook_async.delay(webhook_id, event_type, webhook_data)
        
        return {
            "webhook_id": webhook_id,
            "status": "received",
            "async": True,  # Processing happens async
        }
    
    def _get_squad_headers(self) -> dict:
        """Get Squad API headers with authentication."""
        return {
            "Authorization": f"Bearer {settings.SQUAD_SECRET_KEY}",
            "Content-Type": "application/json",
        }
