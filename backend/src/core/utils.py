"""
Shared utility helpers used across routers and workers.
"""


def mask_account_number(account: str) -> str:
    """Show first 4 digits, mask the rest with asterisks."""
    if not account or len(account) < 4:
        return "****"
    return account[:4] + "*" * (len(account) - 4)


def format_naira(kobo: int) -> str:
    """Format kobo as Naira string: 4500000 → '₦45,000'"""
    naira = kobo / 100
    return f"₦{naira:,.0f}"


def display_name(first_name: str, last_name: str) -> str:
    """Privacy-safe display name: 'Mama K.'"""
    if last_name:
        return f"{first_name} {last_name[0]}."
    return first_name


def get_pulse_tier(score: int) -> str:
    """Map pulse score (0-850) to tier name."""
    if score >= 700:
        return "Gold"
    if score >= 400:
        return "Silver"
    return "Bronze"
