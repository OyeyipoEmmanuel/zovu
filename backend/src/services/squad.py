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
import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = structlog.get_logger()


# Squad issues virtual accounts via GTBank by default. Map known codes to names
# so the user-facing payload always carries a real bank name even if Squad
# changes the issuing partner in future.
SQUAD_BANK_CODE_TO_NAME: dict[str, str] = {
    "058": "GTBank",
    "044": "Access Bank",
    "035": "Wema Bank",
    "232": "Sterling Bank",
    "057": "Zenith Bank",
    "011": "First Bank",
    "033": "United Bank for Africa",
    "070": "Fidelity Bank",
    "221": "Stanbic IBTC",
    "215": "Unity Bank",
    "082": "Keystone Bank",
    "076": "Polaris Bank",
    "032": "Union Bank",
    "050": "Ecobank",
    "030": "Heritage Bank",
    "100": "SunTrust Bank",
    "101": "Providus Bank",
    "50515": "Moniepoint MFB",
    "50211": "Kuda Bank",
}


# Squad's NIBSS lookup expects the 6-digit NIP institution code, not the
# 3-digit CBN sort code. Map common 3-digit CBN codes to their NIP equivalents
# so older callers (KYC payouts) keep working transparently.
CBN_TO_NIP_CODE: dict[str, str] = {
    "058": "000013",  # GTBank
    "044": "000014",  # Access Bank
    "035": "000017",  # Wema Bank
    "232": "000001",  # Sterling Bank
    "057": "000015",  # Zenith Bank
    "011": "000016",  # First Bank
    "033": "000004",  # UBA
    "070": "000007",  # Fidelity Bank
    "221": "000012",  # Stanbic IBTC
    "215": "000011",  # Unity Bank
    "082": "000002",  # Keystone Bank
    "076": "000008",  # Polaris Bank
    "032": "000018",  # Union Bank
    "050": "000010",  # Ecobank
    "030": "000020",  # Heritage Bank
    "101": "000023",  # Providus Bank
    "50515": "090405",  # Moniepoint MFB
    "50211": "090267",  # Kuda Bank
}


def to_nip_code(code: str) -> str:
    """Convert any incoming bank code to the 6-digit NIP code Squad requires.

    Squad strictly enforces a 6-character NIP code on /payout/account/lookup
    and /payout/transfer — passing the legacy 3-digit CBN code is rejected
    with "nip_code length must be 6 characters long".
    """
    code = (code or "").strip()
    if not code:
        return ""
    if len(code) == 6 and code.isdigit():
        return code
    if code in CBN_TO_NIP_CODE:
        return CBN_TO_NIP_CODE[code]
    return code.zfill(6)[:6]


def _normalize_mobile(phone: str) -> str:
    """Squad expects an 11-digit MSISDN starting with 0 (e.g. 08012345678)."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("234") and len(digits) == 13:
        digits = "0" + digits[3:]
    elif digits.startswith("234") and len(digits) > 13:
        digits = "0" + digits[3:]
    if len(digits) == 10 and not digits.startswith("0"):
        digits = "0" + digits
    return digits


def _split_full_name(full_name: str) -> tuple[str, str]:
    """Best-effort split for users who only have a `full_name` field."""
    parts = (full_name or "").strip().split(maxsplit=1)
    if len(parts) == 2:
        return parts[0], parts[1]
    if len(parts) == 1:
        return parts[0], parts[0]
    return "User", "Zovu"


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

    async def create_virtual_account(
        self,
        user: User,
        *,
        bvn: str,
        phone: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        middle_name: Optional[str] = None,
        dob: Optional[str] = None,
        gender: Optional[str] = None,
        address: Optional[str] = None,
    ) -> dict:
        """
        Create a permanent virtual account for the user.

        Squad's `/virtual-account` endpoint requires the full KYC payload:
          - 11-digit BVN, 11-digit mobile (08xxxxxxxxx)
          - dob in mm/dd/yyyy
          - gender ("1" male, "2" female)
          - address, middle_name, first_name, last_name, email
          - beneficiary_account: the merchant settlement code
            (AJO_SQUAD_MERCHANT_ACCOUNT in our config, e.g. "SB558VQ8X8")
          - is_permanent is NOT allowed (Squad removed it)

        Caller is responsible for decrypting BVN/phone from the encrypted
        columns before passing them in.

        Idempotent: if `squad_provisioned` is already True, returns existing data
        without calling Squad again.
        """
        if user.squad_provisioned and user.squad_account_number:
            logger.info("squad_va_already_provisioned", user_id=user.id)
            return {
                "squad_account_id": user.squad_account_id,
                "account_number": user.squad_account_number,
                "bank": user.squad_account_bank,
            }

        # Resolve names: KYC fields > user.first_name/last_name > split full_name > fallback
        fname = (first_name or user.first_name or "").strip()
        lname = (last_name or user.last_name or "").strip()
        if not fname or not lname:
            split_fname, split_lname = _split_full_name(
                user.full_name or user.business_name or user.company_name or ""
            )
            fname = fname or split_fname
            lname = lname or split_lname

        mobile = _normalize_mobile(phone)
        bvn = (bvn or "").strip()

        # Squad will reject these client-side — fail fast with a useful message
        # instead of waiting for an opaque 400.
        if not re.fullmatch(r"\d{11}", bvn):
            raise ValidationError(
                "Squad virtual account requires a valid 11-digit BVN. "
                f"Got {len(bvn)}-char value."
            )
        if not re.fullmatch(r"0\d{10}", mobile):
            raise ValidationError(
                "Squad virtual account requires an 11-digit mobile number starting with 0. "
                f"Got {mobile!r}."
            )

        # Resolve dob → mm/dd/yyyy
        dob_str = (dob or "").strip()
        if not dob_str and user.date_of_birth is not None:
            dob_str = user.date_of_birth.strftime("%m/%d/%Y")
        if not dob_str:
            raise ValidationError(
                "Squad virtual account requires a date of birth (mm/dd/yyyy)."
            )

        # Squad expects exactly mm/dd/yyyy. Try to normalise common alternatives.
        if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", dob_str):
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
                try:
                    import datetime as _dt
                    dob_str = _dt.datetime.strptime(dob_str, fmt).strftime("%m/%d/%Y")
                    break
                except ValueError:
                    continue
        if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", dob_str):
            raise ValidationError(
                f"Could not parse date of birth {dob!r}; expected mm/dd/yyyy."
            )

        gender_str = (gender or "1").strip()
        if gender_str not in ("1", "2"):
            gender_str = "1"

        address_str = (address or getattr(user, "address", None) or "Nigeria").strip() or "Nigeria"
        middle = (middle_name or "").strip() or fname  # Squad requires a middle name

        beneficiary = (
            settings.AJO_SQUAD_MERCHANT_ACCOUNT
            or settings.SQUAD_MERCHANT_ACCOUNT_NUMBER
            or ""
        ).strip()
        if not beneficiary:
            raise ValidationError(
                "AJO_SQUAD_MERCHANT_ACCOUNT (Squad merchant code) must be set "
                "before creating virtual accounts."
            )

        payload = {
            "customer_identifier": str(user.id),
            "first_name": fname,
            "last_name": lname,
            "middle_name": middle,
            "mobile_num": mobile,
            "email": user.email,
            "bvn": bvn,
            "dob": dob_str,
            "gender": gender_str,
            "address": address_str,
            "beneficiary_account": beneficiary,
        }

        logger.info("squad_create_va_start", user_id=user.id, customer_identifier=str(user.id))

        data = await self._post_with_retry("/virtual-account", payload)

        va_data = data.get("data") or {}
        account_number = va_data.get("virtual_account_number") or va_data.get("account_number")
        bank_code = va_data.get("bank_code") or ""
        bank_name = SQUAD_BANK_CODE_TO_NAME.get(bank_code, va_data.get("bank") or "GTBank")
        # Squad's customer VA response has no separate "id" field; the account
        # number is the canonical identifier. Keep `customer_identifier` in
        # `squad_account_id` so we can later look the account up by user.
        squad_id = (
            va_data.get("id")
            or va_data.get("virtual_account_id")
            or va_data.get("customer_identifier")
            or str(user.id)
        )

        if not account_number:
            logger.error("squad_va_missing_account_number", user_id=user.id, response=data)
            raise ExternalServiceError(
                "Squad",
                "Virtual account creation returned no account number",
            )

        user.squad_account_id = squad_id
        user.squad_account_number = account_number
        user.squad_account_bank = bank_name
        user.squad_provisioned = True

        await self.db.commit()

        logger.info(
            "squad_va_created",
            user_id=user.id,
            account_number=account_number,
            bank_code=bank_code,
            bank=bank_name,
        )

        return {
            "squad_account_id": squad_id,
            "account_number": account_number,
            "bank": bank_name,
            "bank_code": bank_code,
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

        data = await self._post_with_retry("/transaction/initiate", payload)

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

        data = await self._get_with_retry(f"/transaction/verify/{transaction_ref}")

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

        data = await self._post_with_retry("/transaction/validate-payment", payload)

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

        data = await self._post_with_retry("/transaction/payment/authorize", payload)

        return {
            "transaction_ref": transaction_ref,
            "status": data.get("data", {}).get("transaction_status", "unknown"),
            "redirect_url": data.get("data", {}).get("redirect_url"),
        }

    # ------------------------------------------------------------------ #
    #  Transfers                                                           #
    # ------------------------------------------------------------------ #

    async def lookup_account(
        self,
        account_number: str,
        bank_code: str,
    ) -> dict:
        """
        Resolve a beneficiary account against NIBSS via Squad.
        POST /payout/account/lookup
        Must be called before every transfer — Squad rejects transfers without
        a matching `account_name` from this lookup.

        Squad now mandates the 6-digit NIP code under the `bank_code` field
        (e.g. "000013" for GTBank). The legacy 3-digit CBN code is rejected
        with: `"nip_code" length must be 6 characters long`. Callers that
        still pass a 3-digit CBN code get mapped to the canonical NIP code
        via CBN_TO_NIP_CODE.

        Important: Squad rejects an explicit `nip_code` field with
        `"nip_code" is not allowed` — only `bank_code` should be sent.
        """
        nip_code = to_nip_code(bank_code)
        if not nip_code:
            raise ValidationError("bank_code is required for account lookup")

        payload = {
            "bank_code": nip_code,
            "account_number": account_number,
        }

        logger.info("squad_account_lookup", account_number=account_number, bank_code=nip_code)

        data = await self._post_with_retry("/payout/account/lookup", payload)

        info = data.get("data") or {}
        return {
            "account_number": info.get("account_number") or account_number,
            "account_name": info.get("account_name"),
            "bank_code": info.get("bank_code") or bank_code,
        }

    async def transfer_funds(
        self,
        recipient_account: str,
        bank_code: str,
        amount_kobo: int,
        reference: str,
        narration: str,
        account_name: Optional[str] = None,
    ) -> dict:
        """
        Initiate a transfer. Amount in KOBO (converted to naira for Squad).
        Reference must be unique — caller should use f"zovu-{uuid4().hex}".

        If `account_name` is not supplied, a /payout/account/lookup is performed
        first as required by Squad.
        """
        if not bank_code:
            raise ValidationError("bank_code is required for transfers")

        nip_code = to_nip_code(bank_code)

        if not account_name:
            lookup = await self.lookup_account(recipient_account, nip_code)
            account_name = lookup.get("account_name")
            if not account_name:
                raise ExternalServiceError(
                    "Squad",
                    f"Account name lookup returned empty for {recipient_account}/{nip_code}",
                )

        amount_naira = amount_kobo / 100

        logger.info(
            "squad_transfer_start",
            recipient=recipient_account,
            bank_code=nip_code,
            amount_naira=amount_naira,
            reference=reference,
        )

        payload = {
            "transaction_reference": reference,
            "amount": str(amount_naira),  # Squad expects amount as a string
            "bank_code": nip_code,
            "account_number": recipient_account,
            "account_name": account_name,
            "narration": narration,
            "currency_id": "NGN",
        }

        data = await self._post_with_retry("/payout/transfer", payload)

        body = data.get("data") or {}
        return {
            "squad_transaction_id": body.get("transaction_ref") or reference,
            "status": body.get("status") or body.get("transaction_status") or "pending",
            "nip_session_id": body.get("nip_session_id"),
        }

    async def requery_transfer(self, reference: str) -> dict:
        """
        Re-query a transfer's status. Per spec, always call this after a 424
        Timeout before retrying — never retry blind.
        POST /payout/requery
        """
        payload = {"transaction_reference": reference}
        logger.info("squad_requery_transfer", reference=reference)
        data = await self._post_with_retry("/payout/requery", payload)
        body = data.get("data") or {}
        return {
            "reference": reference,
            "status": body.get("transaction_status") or body.get("status") or "unknown",
        }

    # ------------------------------------------------------------------ #
    #  Webhook                                                             #
    # ------------------------------------------------------------------ #

    def verify_webhook_signature(self, payload_bytes: bytes, signature: str) -> bool:
        """HMAC-SHA512 using SQUAD_SECRET_KEY. Returns True if valid."""
        if not signature:
            return False
        expected = hmac.new(
            self.secret_key.encode(),
            payload_bytes,
            hashlib.sha512,
        ).hexdigest()

        is_valid = hmac.compare_digest(expected.upper(), signature.upper())

        if not is_valid:
            logger.warning("webhook_signature_invalid")

        return is_valid

    async def claim_webhook_idempotency(self, webhook_id: str) -> bool:
        """
        Atomically claim a webhook id for processing.
        Returns True if this is the first time we've seen it, False if already
        processed (caller should ack 200 and return without further work).
        """
        idempotency_key = f"squad_webhook:{webhook_id}"
        was_new = await self.redis.set(idempotency_key, "1", nx=True, ex=86400)
        return bool(was_new)

    async def persist_webhook_log(self, webhook_id: str, event_type: str, payload: dict) -> None:
        """Persist a raw webhook event for audit. Called from the Celery worker."""
        webhook_log = SquadWebhookLog(
            webhook_id=webhook_id,
            event_type=event_type,
            payload=payload,
            processed=False,
        )
        self.db.add(webhook_log)
        await self.db.commit()
        logger.info("webhook_logged", webhook_id=webhook_id, event_type=event_type)

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
        return self._handle_response(response, path)

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
        return self._handle_response(response, path)

    def _handle_response(self, response: httpx.Response, path: str) -> dict:
        """
        Parse a Squad response. Surfaces Squad's own error message instead of
        burying it inside a generic 'request failed'. Tenacity will only retry
        on httpx.HTTPError (network/timeout) — 4xx responses become
        ExternalServiceError immediately.
        """
        # Try to parse JSON regardless of status — Squad's error payloads are JSON
        try:
            body = response.json()
        except ValueError:
            body = {"raw": response.text[:1000]}

        if response.status_code not in (200, 201):
            squad_message = (
                body.get("message")
                or body.get("error")
                or body.get("data", {}).get("message")
                if isinstance(body, dict)
                else None
            )
            logger.error(
                "squad_api_error",
                path=path,
                status=response.status_code,
                squad_message=squad_message,
                body=body,
            )
            # 4xx from Squad is deterministic — don't retry, raise immediately
            raise ExternalServiceError(
                "Squad",
                f"{path} -> {response.status_code}: {squad_message or 'no message'}",
            )

        if isinstance(body, dict) and body.get("success") is False:
            logger.error("squad_api_logical_failure", path=path, body=body)
            raise ExternalServiceError(
                "Squad",
                f"{path} -> {body.get('message', 'unknown failure')}",
            )

        return body

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }
