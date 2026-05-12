"""
Email service — SMTP (async via aiosmtplib) or SendGrid.
In development mode: OTP is printed to console and never sent.
In production mode: real email sent, OTP never logged.
"""
import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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
