"""
Email service — SMTP (async via aiosmtplib) or SendGrid.
In development mode: OTP is printed to console and never sent.
In production mode: real email sent, OTP never logged.
"""
import asyncio
import smtplib
import ssl
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.config import settings
import structlog

logger = structlog.get_logger()


class EmailService:
    """Async email service supporting SMTP and SendGrid providers."""

    async def send_otp(self, to_email: str, otp: str, user_name: str) -> None:
        """
        Send OTP verification email.
        Subject: "Your Zovu verification code: {otp}"
        In dev: print to console only. In prod: send real email.
        """
        subject = f"Your Zovu verification code: {otp}"
        body = self._otp_html(otp, user_name)

        if settings.ENVIRONMENT != "production":
            logger.info(
                "dev_otp_email",
                to=to_email,
                otp=otp,
                note="NOT sent — dev mode",
            )
            print(f"\n{'='*50}")
            print(f"  [DEV] OTP for {to_email}: {otp}")
            print(f"{'='*50}\n")
            return

        await self._send(to_email, subject, body)

    async def send_welcome(
        self,
        to_email: str,
        user_name: str,
        account_number: str | None,
    ) -> None:
        """
        Send welcome email after OTP verified.
        Includes Squad virtual account number if provisioned.
        """
        subject = "Welcome to Zovu! Your account is ready."
        body = self._welcome_html(user_name, account_number)

        if settings.ENVIRONMENT != "production":
            logger.info("dev_welcome_email", to=to_email, note="NOT sent — dev mode")
            return

        await self._send(to_email, subject, body)

    async def send_receipt(
        self,
        user_id: UUID | str,
        transaction_id: UUID | str,
        db: AsyncSession,
    ) -> None:
        """
        Fetch the user + the full transaction detail and send a receipt email.

        Non-blocking on failure: any exception is logged and swallowed so the
        Squad webhook handler (or any other caller) can never be derailed by an
        email outage.

        Email content:
          - Subject: "ZOVU Receipt – ₦{amount} {type_label}"
          - HTML body: ZOVU header, transaction details table
            (type, amount, counterparty, reference, timestamp),
            current Pulse Score, support link at bottom.
        """
        try:
            # Lazy imports — avoid module-level cycles between services/models.
            from src.models import User, Transaction, Ajo, Gig
            from src.routers.transactions import (
                _counterparty_for,
                _type_label,
                _build_enrichment_caches,
            )
            from src.core.utils import format_naira

            user = await db.scalar(select(User).where(User.id == str(user_id)))
            if user is None or not user.email:
                logger.warning(
                    "email_receipt_skipped_no_user_or_email",
                    user_id=str(user_id),
                    transaction_id=str(transaction_id),
                )
                return

            tx = await db.scalar(
                select(Transaction).where(Transaction.id == str(transaction_id))
            )
            if tx is None:
                logger.warning(
                    "email_receipt_skipped_tx_not_found",
                    user_id=str(user_id),
                    transaction_id=str(transaction_id),
                )
                return

            # Re-use the router's enrichment helpers so the wording stays
            # consistent with what the user sees in-app.
            user_cache, ajo_cache, gig_cache = await _build_enrichment_caches(db, [tx])
            counterparty_display = _counterparty_for(tx, user, user_cache, ajo_cache)
            type_label = _type_label(tx)
            amount_display = format_naira(int(tx.amount or 0))

            reference = tx.squad_reference or tx.id
            created_at = tx.created_at or datetime.now(timezone.utc)
            timestamp = created_at.strftime("%d %b %Y, %H:%M UTC")
            display_name = (
                (user.full_name or "").strip()
                or f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
                or user.business_name
                or user.company_name
                or user.email
            )

            subject = f"ZOVU Receipt – {amount_display} {type_label}"
            body = self._receipt_html(
                user_name=display_name or "there",
                type_label=type_label,
                amount_display=amount_display,
                counterparty=counterparty_display or "ZOVU System",
                reference=reference,
                timestamp=timestamp,
                pulse_score=int(user.pulse_score or 0),
            )

            if settings.ENVIRONMENT != "production":
                logger.info(
                    "dev_receipt_email",
                    to=user.email,
                    transaction_id=str(tx.id),
                    note="NOT sent — dev mode",
                )
                return

            await self._send(user.email, subject, body)
        except Exception as exc:
            # Email outage MUST NEVER break the calling Squad webhook flow.
            logger.error(
                "email_receipt_failed",
                user_id=str(user_id),
                transaction_id=str(transaction_id),
                error=str(exc),
            )

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    async def _send(self, to_email: str, subject: str, html_body: str) -> None:
        """Dispatch to the configured provider."""
        if settings.EMAIL_PROVIDER == "sendgrid":
            await self._send_sendgrid(to_email, subject, html_body)
        else:
            await self._send_smtp(to_email, subject, html_body)

    async def _send_smtp(self, to_email: str, subject: str, html_body: str) -> None:
        """Send via SMTP using a thread executor (smtplib is synchronous)."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._smtp_blocking,
            to_email,
            subject,
            html_body,
        )

    def _smtp_blocking(self, to_email: str, subject: str, html_body: str) -> None:
        """Blocking SMTP call — runs inside executor."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())

        logger.info("smtp_email_sent", to=to_email, subject=subject)

    async def _send_sendgrid(self, to_email: str, subject: str, html_body: str) -> None:
        """Send via SendGrid HTTP API using httpx."""
        import httpx

        if not settings.SENDGRID_API_KEY:
            logger.error("sendgrid_key_missing")
            return

        payload = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": settings.FROM_EMAIL, "name": settings.FROM_NAME},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_body}],
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code not in (200, 202):
                logger.error("sendgrid_send_failed", status=resp.status_code, body=resp.text)
            else:
                logger.info("sendgrid_email_sent", to=to_email)

    # ------------------------------------------------------------------ #
    #  Email templates                                                     #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _otp_html(otp: str, user_name: str) -> str:
        return f"""
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin-bottom:4px;">Zovu</h1>
    <p style="color:#555;margin-top:0;">African Economic Inclusion</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:16px;">Hi {user_name},</p>
    <p>Your verification code is:</p>
    <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;
                background:#f0f4ff;padding:16px;border-radius:6px;text-align:center;">
      {otp}
    </div>
    <p style="color:#888;font-size:13px;margin-top:16px;">
      This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#aaa;font-size:12px;text-align:center;">
      &copy; 2025 Zovu. All rights reserved.
    </p>
  </div>
</body>
</html>"""

    @staticmethod
    def _receipt_html(
        user_name: str,
        type_label: str,
        amount_display: str,
        counterparty: str,
        reference: str,
        timestamp: str,
        pulse_score: int,
    ) -> str:
        return f"""
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin-bottom:4px;">Zovu</h1>
    <p style="color:#555;margin-top:0;">Transaction Receipt</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:16px;">Hi {user_name},</p>
    <p style="color:#555;">Here is your receipt for the transaction below.</p>
    <div style="background:#f0f4ff;border-radius:6px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:13px;color:#555;">{type_label}</p>
      <p style="margin:6px 0 0;font-size:28px;font-weight:bold;color:#1a1a2e;">
        {amount_display}
      </p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;margin-top:8px;">
      <tr>
        <td style="padding:8px 0;color:#888;">Type</td>
        <td style="padding:8px 0;text-align:right;"><strong>{type_label}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;border-top:1px solid #eee;">Amount</td>
        <td style="padding:8px 0;text-align:right;border-top:1px solid #eee;"><strong>{amount_display}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;border-top:1px solid #eee;">Counterparty</td>
        <td style="padding:8px 0;text-align:right;border-top:1px solid #eee;"><strong>{counterparty}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;border-top:1px solid #eee;">Reference</td>
        <td style="padding:8px 0;text-align:right;border-top:1px solid #eee;font-family:monospace;font-size:12px;">{reference}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;border-top:1px solid #eee;">Timestamp</td>
        <td style="padding:8px 0;text-align:right;border-top:1px solid #eee;">{timestamp}</td>
      </tr>
    </table>
    <div style="background:#fff8e7;border-radius:6px;padding:12px 16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#555;">Your current Pulse Score</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:#1a1a2e;">
        {pulse_score} <span style="font-size:12px;color:#888;font-weight:normal;">/ 850</span>
      </p>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#888;font-size:13px;text-align:center;">
      Questions? <a href="mailto:support@zovu.app" style="color:#1a1a2e;">Contact support</a>
    </p>
    <p style="color:#aaa;font-size:12px;text-align:center;">
      &copy; 2025 Zovu. All rights reserved.
    </p>
  </div>
</body>
</html>"""

    @staticmethod
    def _welcome_html(user_name: str, account_number: str | None) -> str:
        account_section = ""
        if account_number:
            account_section = f"""
    <div style="background:#f0f4ff;border-radius:6px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#555;">Your virtual account number:</p>
      <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#1a1a2e;letter-spacing:3px;">
        {account_number}
      </p>
    </div>"""

        return f"""
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin-bottom:4px;">Welcome to Zovu, {user_name}!</h1>
    <p style="color:#555;">Your account has been verified and is ready to use.</p>
    {account_section}
    <p style="color:#555;font-size:14px;">
      Start exploring loans, savings groups (Ajo), and the marketplace today.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#aaa;font-size:12px;text-align:center;">
      &copy; 2025 Zovu. All rights reserved.
    </p>
  </div>
</body>
</html>"""
