"""
Squad API integration service — virtual accounts, transfers, webhook handling.
Uses a shared httpx.AsyncClient (connection pooling, timeout=30s).
All external calls wrapped with tenacity (3 attempts, exponential backoff).
HMAC-SHA512 signature verification for webhook security.
"""
from src.config import settings
from src.models import User, SquadWebhookLog
from src.core.exceptions import ExternalServiceError, ValidationError
import structlog
import httpx
import hmac
import hashlib
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = structlog.get_logger()


class SquadService:
    """Squad API integration service with shared HTTP client."""

    def __init__(self, db: AsyncSession, redis: Redis, http: Optional[httpx.AsyncClient] = None):
        self.http = http
        self.db = db
        self.redis = redis
        self.base_url = settings.SQUAD_BASE_URL.rstrip("/")
        self.secret_key = settings.SQUAD_SECRET_KEY
        self.public_key = settings.SQUAD_PUBLIC_KEY

    # ------------------------------------------------------------------ #
    #  Virtual account                                                     #
    # ------------------------------------------------------------------ #

    async def create_virtual_account(self, user: User) -> dict:
        """
        Idempotent: if squad_account_id already set, return existing data.
        Called immediately after OTP verification succeeds.
        """
        if user.squad_account_id and user.squad_provisioned:
            logger.info("squad_va_already_provisioned", user_id=user.id)
            return {
                "squad_account_id": user.squad_account_id,
                "account_number": user.squad_account_number,
                "bank": user.squad_account_bank,
            }

        display_name = (
            user.full_name
            or user.business_name
            or user.company_name
            or user.first_name
            or "User"
        )

        payload = {
            "email": f"{user.id}@zovu.internal",
            "first_name": display_name,
            "last_name": "Zovu",
            "mobile_num": "",
            "bvn": "",
            "is_permanent": True,
            "customer_identifier": str(user.id),
        }

        logger.info("squad_create_va_start", user_id=user.id)

        try:
            data = await self._post_with_retry("/virtual-account", payload)
        except Exception as exc:
            logger.error("squad_create_va_failed", user_id=user.id, error=str(exc))
            raise ExternalServiceError("Squad", "Failed to create virtual account")

        va_data = data.get("data", data)
        account_number = va_data.get("virtual_account_number") or va_data.get("account_number")
        bank = va_data.get("bank_name") or va_data.get("bank") or "Access Bank"
        squad_id = va_data.get("id") or va_data.get("virtual_account_id")

        user.squad_account_id = squad_id
        user.squad_account_number = account_number
        user.squad_account_bank = bank
        user.squad_provisioned = True
        user.squad_virtual_account_id = squad_id  # keep legacy field in sync

        await self.db.commit()

        logger.info(
            "squad_va_created",
            user_id=user.id,
            account_number=account_number,
            bank=bank,
        )

        return {
            "squad_account_id": squad_id,
            "account_number": account_number,
            "bank": bank,
        }

    # ------------------------------------------------------------------ #
    #  Checkout / direct payment initiation                               #
    # ------------------------------------------------------------------ #

    async def initiate_payment(
        self,
        email: str,
        amount_kobo: int,
        reference: str,
        callback_url: str,
        currency: str = "NGN",
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Initiate a checkout payment session.
        Amount in KOBO. Returns checkout URL from Squad.
        POST /transaction/initiate
        """
        payload = {
            "email": email,
            "amount": amount_kobo,
            "initiate_type": "inline",
            "currency": currency,
            "transaction_ref": reference,
            "callback_url": callback_url,
        }
        if metadata:
            payload["pass_charge"] = False
            payload["metadata"] = metadata

        logger.info("squad_initiate_payment", reference=reference, amount_kobo=amount_kobo)

        try:
            data = await self._post_with_retry("/transaction/initiate", payload)
        except Exception as exc:
            logger.error("squad_initiate_payment_failed", reference=reference, error=str(exc))
            raise ExternalServiceError("Squad", "Failed to initiate payment")

        return {
            "checkout_url": data.get("data", {}).get("checkout_url"),
            "transaction_ref": reference,
            "status": data.get("data", {}).get("transaction_status", "pending"),
        }

    async def verify_transaction(self, transaction_ref: str) -> dict:
        """
        Verify a transaction by its reference.
        GET /transaction/verify/{transaction_ref}
        """
        logger.info("squad_verify_transaction", transaction_ref=transaction_ref)

        try:
            data = await self._get_with_retry(f"/transaction/verify/{transaction_ref}")
        except Exception as exc:
            logger.error("squad_verify_failed", transaction_ref=transaction_ref, error=str(exc))
            raise ExternalServiceError("Squad", "Failed to verify transaction")

        tx = data.get("data", {})
        return {
            "transaction_ref": transaction_ref,
            "status": tx.get("transaction_status", "unknown"),
            "amount": tx.get("transaction_amount"),
            "currency": tx.get("currency_id", "NGN"),
            "gateway_ref": tx.get("gateway_ref"),
        }

    async def validate_bank_payment(
        self,
        transaction_ref: str,
        otp: str,
    ) -> dict:
        """
        Validate a direct bank payment (OTP step).
        POST /transaction/validate-payment
        """
        payload = {"transaction_ref": transaction_ref, "otp": otp}

        logger.info("squad_validate_bank_payment", transaction_ref=transaction_ref)

        try:
            data = await self._post_with_retry("/transaction/validate-payment", payload)
        except Exception as exc:
            logger.error("squad_validate_payment_failed", transaction_ref=transaction_ref, error=str(exc))
            raise ExternalServiceError("Squad", "Bank payment validation failed")

        return {
            "transaction_ref": transaction_ref,
            "status": data.get("data", {}).get("transaction_status", "unknown"),
        }

    async def authorize_card_payment(
        self,
        transaction_ref: str,
        card_token: str,
    ) -> dict:
        """
        Authorize a card payment using a card token.
        POST /transaction/payment/authorize
        """
        payload = {"transaction_ref": transaction_ref, "card_token": card_token}

        logger.info("squad_authorize_card", transaction_ref=transaction_ref)

        try:
            data = await self._post_with_retry("/transaction/payment/authorize", payload)
        except Exception as exc:
            logger.error("squad_authorize_card_failed", transaction_ref=transaction_ref, error=str(exc))
            raise ExternalServiceError("Squad", "Card authorization failed")

        return {
            "transaction_ref": transaction_ref,
            "status": data.get("data", {}).get("transaction_status", "unknown"),
            "redirect_url": data.get("data", {}).get("redirect_url"),
        }

    # ------------------------------------------------------------------ #
    #  Transfers                                                           #
    # ------------------------------------------------------------------ #

    async def transfer_funds(
        self,
        recipient_account: str,
        amount_kobo: int,
        reference: str,
        narration: str,
    ) -> dict:
        """
        Initiate a transfer. Amount in KOBO (converted to naira for Squad).
        Reference must be unique — caller should use f"zovu-{uuid4().hex}".
        """
        amount_naira = amount_kobo / 100

        logger.info(
            "squad_transfer_start",
            recipient=recipient_account,
            amount_naira=amount_naira,
            reference=reference,
        )

        payload = {
            "transaction_reference": reference,
            "amount": amount_naira,
            "bank_code": "",
            "account_number": recipient_account,
            "account_name": "",
            "narration": narration,
            "currency_id": "NGN",
        }

        try:
            data = await self._post_with_retry("/payout/transfer", payload)
        except Exception as exc:
            logger.error("squad_transfer_failed", reference=reference, error=str(exc))
            raise ExternalServiceError("Squad", "Transfer initiation failed")

        return {
            "squad_transaction_id": data.get("data", {}).get("transaction_ref", reference),
            "status": data.get("data", {}).get("status", "pending"),
        }

    # ------------------------------------------------------------------ #
    #  Webhook                                                             #
    # ------------------------------------------------------------------ #

    def verify_webhook_signature(self, payload_bytes: bytes, signature: str) -> bool:
        """HMAC-SHA512 using SQUAD_SECRET_KEY. Returns True if valid."""
        expected = hmac.new(
            self.secret_key.encode(),
            payload_bytes,
            hashlib.sha512,
        ).hexdigest()

        is_valid = hmac.compare_digest(expected.upper(), signature.upper())

        if not is_valid:
            logger.warning("webhook_signature_invalid")

        return is_valid

    async def handle_webhook(self, webhook_data: dict) -> dict:
        """
        Handle Squad webhook with Redis idempotency (atomic SET nx=True).
        """
        webhook_id = webhook_data.get("id") or webhook_data.get("transaction_ref")
        event_type = webhook_data.get("event") or webhook_data.get("event_type", "unknown")

        if not webhook_id:
            raise ValidationError("Missing webhook id")

        idempotency_key = f"squad_webhook:{webhook_id}"
        was_new = await self.redis.set(idempotency_key, "1", nx=True, ex=86400)

        if not was_new:
            logger.info("webhook_already_processed", webhook_id=webhook_id)
            return {"webhook_id": webhook_id, "status": "already_processed"}

        webhook_log = SquadWebhookLog(
            webhook_id=webhook_id,
            event_type=event_type,
            payload=webhook_data,
            processed=False,
        )
        self.db.add(webhook_log)
        await self.db.commit()

        logger.info("webhook_logged", webhook_id=webhook_id, event_type=event_type)

        return {"webhook_id": webhook_id, "status": "received", "async": True}

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(httpx.HTTPError),
        reraise=True,
    )
    async def _post_with_retry(self, path: str, payload: dict) -> dict:
        """POST to Squad with tenacity retry (3 attempts, exponential backoff)."""
        if self.http is None:
            raise ExternalServiceError("Squad", "HTTP client not initialised for this operation")
        url = f"{self.base_url}{path}"
        response = await self.http.post(url, json=payload, headers=self._headers())

        if response.status_code not in (200, 201):
            logger.error(
                "squad_api_error",
                url=url,
                status=response.status_code,
                body=response.text[:200],
            )
            response.raise_for_status()

        return response.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(httpx.HTTPError),
        reraise=True,
    )
    async def _get_with_retry(self, path: str) -> dict:
        """GET from Squad with tenacity retry (3 attempts, exponential backoff)."""
        if self.http is None:
            raise ExternalServiceError("Squad", "HTTP client not initialised for this operation")
        url = f"{self.base_url}{path}"
        response = await self.http.get(url, headers=self._headers())

        if response.status_code not in (200, 201):
            logger.error(
                "squad_api_error",
                url=url,
                status=response.status_code,
                body=response.text[:200],
            )
            response.raise_for_status()

        return response.json()

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }
