"""
Data seeder — loads CSV data into the database on startup.

Strategy:
  - traders_final.csv  → User(user_type=TRADER)
  - seekers_final.csv  → User(user_type=SEEKER)
  - jobs_final.csv     → Gig  (links trader_id → seeker_id via lookup maps)
  - transactions_final.csv → Transaction (linked to User via lookup map)

The seeder is IDEMPOTENT: it checks if data already exists before inserting,
so it is safe to call every time the server starts.
"""

import os
import uuid
import ast
import structlog
import pandas as pd

from collections import defaultdict
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.core.database import async_session
from src.models.base import (
    User,
    UserType,
    UserStatus,
    Gig,
    GigStatus,
    Transaction,
    TransactionType,
    EconomicContext,
    ShieldStatus,
    BusinessType,
    Ajo,
    AjoMembership,
)

logger = structlog.get_logger()

# ── Paths ────────────────────────────────────────────────────────────────────
_FALLBACK_DATA_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "AI-engineer", "data")
)
_DATA_DIR = os.environ.get("CSV_DATA_DIR", _FALLBACK_DATA_DIR)

TRADERS_CSV      = os.path.join(_DATA_DIR, "traders_final.csv")
SEEKERS_CSV      = os.path.join(_DATA_DIR, "seekers_final.csv")
JOBS_CSV         = os.path.join(_DATA_DIR, "jobs_final.csv")
TRANSACTIONS_CSV = os.path.join(_DATA_DIR, "transactions_final.csv")


def _validate_csv_paths() -> None:
    """Raise FileNotFoundError if any required CSV is missing."""
    missing = [p for p in [TRADERS_CSV, SEEKERS_CSV, JOBS_CSV, TRANSACTIONS_CSV]
               if not os.path.exists(p)]
    if missing:
        raise FileNotFoundError(
            f"CSV files not found. Set CSV_DATA_DIR env var.\nMissing: {missing}"
        )


# Columns each CSV must have. Extra columns are OK; missing ones abort the seed
# (with a clear log line) so we never silently corrupt the DB from a renamed export.
_REQUIRED_COLUMNS: dict[str, set[str]] = {
    TRADERS_CSV: {
        "trader_id", "email", "first_name", "last_name", "business_name",
    },
    SEEKERS_CSV: {
        "seeker_id", "email", "first_name", "last_name",
    },
    JOBS_CSV: {
        "trader_id", "seeker_id", "skill_required", "amount_paid",
    },
    TRANSACTIONS_CSV: {
        "user_id", "amount_gross", "category", "status",
    },
}


def _validate_csv_schema() -> None:
    """Validate every required CSV has the columns the seeder reads.

    Raises a ValueError listing every missing column across every file so the
    fix is obvious instead of a cascade of KeyErrors halfway through the load.
    """
    issues: list[str] = []
    for path, required in _REQUIRED_COLUMNS.items():
        try:
            header_df = pd.read_csv(path, nrows=0)
        except Exception as exc:
            issues.append(f"{os.path.basename(path)}: failed to read header ({exc})")
            continue
        cols = {c.strip() for c in header_df.columns}
        missing_cols = required - cols
        if missing_cols:
            issues.append(
                f"{os.path.basename(path)}: missing columns {sorted(missing_cols)}; "
                f"present columns are {sorted(cols)}"
            )
    if issues:
        raise ValueError("CSV schema validation failed:\n  - " + "\n  - ".join(issues))


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_shield(value: str | None) -> ShieldStatus:
    """Map CSV shield string → ShieldStatus enum (case-insensitive, safe)."""
    mapping = {
        "none":     ShieldStatus.NONE,
        "bronze":   ShieldStatus.BRONZE,
        "silver":   ShieldStatus.SILVER,
        "gold":     ShieldStatus.GOLD,
        # Seeker-only variants in CSV
        "personal": ShieldStatus.BRONZE,
        "family":   ShieldStatus.SILVER,
    }
    return mapping.get(str(value).lower(), ShieldStatus.NONE)


def _parse_biz_type(value: str | None) -> BusinessType | None:
    """Map CSV business_type string → BusinessType enum."""
    mapping = {
        "wholesaler":    BusinessType.WHOLESALER,
        "retailer":      BusinessType.RETAILER,
        "small kiosk":   BusinessType.SMALL_KIOSK,
        "online vendor": BusinessType.ONLINE_VENDOR,
    }
    return mapping.get(str(value).lower()) if value else None


def _parse_economic_context(value: str | None) -> EconomicContext | None:
    """Map CSV economic_context → EconomicContext enum."""
    mapping = {
        "normal":        EconomicContext.NORMAL,
        "rainy_day":     EconomicContext.RAINY_DAY,
        "fuel_scarcity": EconomicContext.FUEL_SCARCITY,
        "holiday_rush":  EconomicContext.HOLIDAY_RUSH,
        "market_strike": EconomicContext.MARKET_STRIKE,
    }
    return mapping.get(str(value).lower()) if value else None


def _parse_list_field(value) -> list:
    """Safely parse a stringified list (e.g. \"['Yoruba', 'English']\")."""
    if isinstance(value, list):
        return value
    try:
        result = ast.literal_eval(str(value))
        return result if isinstance(result, list) else []
    except Exception:
        return []


def _to_kobo(naira_float) -> int:
    """Convert naira float → kobo integer (multiply × 100)."""
    try:
        return int(float(naira_float) * 100)
    except (ValueError, TypeError):
        return 0


def _naive_to_utc(value) -> datetime:
    """Convert a pandas Timestamp or string to a UTC-aware datetime."""
    try:
        dt = pd.to_datetime(value)
        if dt.tzinfo is None:
            return dt.to_pydatetime().replace(tzinfo=timezone.utc)
        return dt.to_pydatetime()
    except Exception:
        return datetime.now(timezone.utc)


# ── Core seeder functions ─────────────────────────────────────────────────────

async def _seed_traders(session: AsyncSession) -> tuple[dict[str, str], set[str]]:
    """
    Load traders_final.csv → User rows (user_type=TRADER).
    Returns ({csv_trader_id: db_uuid}, set of normalized trader emails).
    """
    logger.info("seeder.traders.start", path=TRADERS_CSV)
    df = pd.read_csv(TRADERS_CSV)
    seen_emails: dict[str, object] = {}
    for _, row in df.iterrows():
        email = str(row.get("email", "")).strip().lower()
        if email and email not in seen_emails:
            seen_emails[email] = row
    rows = list(seen_emails.values())

    id_map: dict[str, str] = {}
    users = []

    for row in rows:
        uid = str(uuid.uuid4())
        id_map[row["trader_id"]] = uid

        users.append(User(
            id=uid,
            email=str(row["email"]),
            phone=b"",                          # placeholder — encrypted in prod
            password_hash="seeded",             # placeholder
            user_type=UserType.TRADER,
            role="trader",                      # role-based endpoints need this set
            email_verified=True,
            status=UserStatus.ACTIVE,
            first_name=str(row["first_name"]),
            last_name=str(row["last_name"]),
            business_name=str(row["business_name"]),
            business_type=_parse_biz_type(row.get("business_type")),
            location=str(row.get("location", "")),
            primary_language=str(row.get("primary_language", "")),
            squad_account_number=str(row.get("squad_account_number", "")),
            squad_provisioned=True,
            # Financial metrics (stored in kobo)
            average_monthly_revenue=_to_kobo(row.get("average_monthly_revenue", 0)),
            ajo_savings_balance=_to_kobo(row.get("ajo_savings_balance", 0)),
            max_credit_limit=_to_kobo(row.get("max_credit_limit", 0)),
            # Scores
            pulse_score=min(850, int(float(row.get("zovu_pulse_score", 0)) * 8.5)),
            ajo_discipline=float(row.get("ajo_consistency_score", 0.0)),
            shield_status=_parse_shield(row.get("shield_status")),
            kyc_verified=True,
            profile_complete=True,
            created_at=_naive_to_utc(row.get("created_at")),
            updated_at=_naive_to_utc(row.get("updated_at")),
        ))

    session.add_all(users)
    await session.flush()
    logger.info("seeder.traders.done", count=len(users))
    return id_map, set(seen_emails.keys())


async def _seed_seekers(session: AsyncSession, existing_emails: set) -> dict[str, str]:
    """
    Load seekers_final.csv → User rows (user_type=SEEKER).
    Returns {csv_seeker_id: db_uuid} lookup map.
    """
    logger.info("seeder.seekers.start", path=SEEKERS_CSV)
    df = pd.read_csv(SEEKERS_CSV)
    seen_emails: dict[str, object] = {}
    for _, row in df.iterrows():
        email = str(row.get("email", "")).strip().lower()
        if email and email not in seen_emails:
            seen_emails[email] = row
    rows = list(seen_emails.values())
    rows = [r for r in rows if str(r["email"]).strip().lower() not in existing_emails]

    id_map: dict[str, str] = {}
    users = []

    for row in rows:
        uid = str(uuid.uuid4())
        id_map[row["seeker_id"]] = uid

        users.append(User(
            id=uid,
            email=str(row["email"]),
            phone=b"",
            password_hash="seeded",
            user_type=UserType.SEEKER,
            role="job_seeker",                  # role-based endpoints need this set
            email_verified=True,
            status=UserStatus.ACTIVE,
            first_name=str(row["first_name"]),
            last_name=str(row["last_name"]),
            location=str(row.get("location", "")),
            squad_account_number=str(row.get("squad_account_number", "")),
            squad_provisioned=True,
            # Seeker-specific fields
            skills_list=_parse_list_field(row.get("skills_list", "[]")),
            languages_spoken=_parse_list_field(row.get("languages_spoken", "[]")),
            # Scores
            pulse_score=min(850, int(float(row.get("zovu_pulse_score", 0)) * 8.5)),
            trust_score=float(row.get("trust_score", 0.0)),
            punctuality_index=float(row.get("punctuality_index", 0.0)),
            completion_rate=float(row.get("completion_rate", 0.0)),
            ajo_savings_balance=_to_kobo(row.get("ajo_savings_balance", 0)),
            auto_save_pct=float(row.get("auto_save_pct", 0.0)),
            shield_status=_parse_shield(row.get("shield_status")),
            kyc_verified=True,
            profile_complete=True,
            created_at=_naive_to_utc(row.get("created_at")),
            updated_at=_naive_to_utc(row.get("updated_at")),
        ))

    session.add_all(users)
    await session.flush()
    logger.info("seeder.seekers.done", count=len(users))
    return id_map


async def _seed_gigs(
    session: AsyncSession,
    trader_map: dict[str, str],
    seeker_map: dict[str, str],
) -> None:
    """
    Load jobs_final.csv → Gig rows.
    Uses trader_map / seeker_map to resolve FK references.
    """
    logger.info("seeder.gigs.start", path=JOBS_CSV)
    df = pd.read_csv(JOBS_CSV)

    # The CSV ships every gig with status="Paid", which would mark them all
    # COMPLETED and leave seekers with an empty marketplace (the seeker-facing
    # endpoints filter on status == OPEN). Carve out the most recent slice as
    # OPEN so the marketplace is actually browsable; older rows stay historical.
    OPEN_GIG_COUNT = 500
    try:
        df_sorted_idx = pd.to_datetime(df["created_at"], errors="coerce").sort_values(ascending=False).index
        open_row_ids = set(df_sorted_idx[:OPEN_GIG_COUNT].tolist())
    except Exception:
        open_row_ids = set(df.index[-OPEN_GIG_COUNT:].tolist())

    gigs = []
    skipped = 0

    # Map CSV "status" → GigStatus.
    def _map_gig_status(csv_status: str | None, has_seeker: bool, force_open: bool) -> GigStatus:
        if force_open:
            return GigStatus.OPEN
        s = (str(csv_status) if csv_status is not None else "").strip().lower()
        if not has_seeker:
            return GigStatus.OPEN
        if s in ("paid", "completed"):
            return GigStatus.COMPLETED
        if s in ("cancelled", "canceled"):
            return GigStatus.CANCELLED
        if s in ("in_progress", "in progress", "ongoing", "assigned", "accepted"):
            return GigStatus.IN_PROGRESS
        if s in ("open", "pending", "unfilled", ""):
            return GigStatus.OPEN
        return GigStatus.COMPLETED

    for idx, row in df.iterrows():
        t_uid = trader_map.get(row["trader_id"])
        s_uid = seeker_map.get(row["seeker_id"])

        if not t_uid:
            skipped += 1
            continue

        status = _map_gig_status(
            row.get("status"),
            has_seeker=bool(s_uid),
            force_open=idx in open_row_ids,
        )
        # Only assign seeker_id when the gig actually moved past OPEN; an
        # OPEN gig with a seeker assigned would block /gigs/{id}/apply.
        seeker_for_gig = s_uid if status != GigStatus.OPEN else None
        completed_at = _naive_to_utc(row.get("updated_at")) if status == GigStatus.COMPLETED else None

        gigs.append(Gig(
            id=str(uuid.uuid4()),
            trader_id=t_uid,
            seeker_id=seeker_for_gig,
            title=f"{row.get('skill_required', 'General')} Job",
            description=None,
            skill_required=str(row.get("skill_required", "")),
            payment_period=str(row.get("job_type", "")),
            location="",                   # will be enriched post-seed
            economic_context=_parse_economic_context(row.get("economic_context")) or EconomicContext.NORMAL,
            amount=_to_kobo(row.get("amount_paid", 0)),
            status=status,
            trader_rating=int(row["trader_rating"]) if pd.notna(row.get("trader_rating")) else None,
            seeker_rating=int(row["seeker_rating"]) if pd.notna(row.get("seeker_rating")) else None,
            created_at=_naive_to_utc(row.get("created_at")),
            updated_at=_naive_to_utc(row.get("updated_at")),
            completed_at=completed_at,
        ))

    session.add_all(gigs)
    await session.flush()
    logger.info("seeder.gigs.done", count=len(gigs), skipped=skipped)


async def _seed_transactions(
    session: AsyncSession,
    trader_map: dict[str, str],
    seeker_map: dict[str, str],
) -> None:
    """
    Load transactions_final.csv → Transaction rows.
    user_id in CSV can be a trader_id or seeker_id — resolved via both maps.
    """
    logger.info("seeder.transactions.start", path=TRANSACTIONS_CSV)
    df = pd.read_csv(TRANSACTIONS_CSV)

    # Map CSV category → TransactionType (best-effort)
    category_map = {
        "sale_inflow":               TransactionType.CREDIT_DEPOSIT,
        "job_payout_inflow":         TransactionType.CREDIT_DEPOSIT,
        "job_payout_debit":          TransactionType.CREDIT_WITHDRAWAL,
        "ajo_contribution":          TransactionType.AJO_CONTRIBUTION,
        "loan_disbursement":         TransactionType.LOAN_DISBURSEMENT,
        "loan_repayment":            TransactionType.LOAN_REPAYMENT,
        "shield_premium":            TransactionType.CREDIT_WITHDRAWAL,
        "accident_cover_premium":    TransactionType.CREDIT_WITHDRAWAL,
        "health_insurance_premium":  TransactionType.CREDIT_WITHDRAWAL,
    }

    transactions = []
    skipped = 0

    for _, row in df.iterrows():
        csv_uid = str(row["user_id"])
        # Resolve to DB UUID — check traders first, then seekers
        db_uid = trader_map.get(csv_uid) or seeker_map.get(csv_uid)

        if not db_uid:
            skipped += 1
            continue

        cat_key = str(row.get("category", "")).lower()
        tx_type = category_map.get(cat_key, TransactionType.CREDIT_DEPOSIT)

        status_raw = str(row.get("status", "")).lower()
        status = "completed" if status_raw == "success" else status_raw  # normalize

        # Direction: inflow → credit, outflow → debit
        direction = "credit" if "inflow" in cat_key or "disbursement" in cat_key else "debit"

        ts = _naive_to_utc(row.get("timestamp"))

        transactions.append(Transaction(
            id=str(uuid.uuid4()),
            sender_id=db_uid if direction == "debit" else None,
            receiver_id=db_uid if direction == "credit" else None,
            transaction_type=tx_type,
            amount=_to_kobo(row.get("amount_gross", 0)),
            amount_gross=_to_kobo(row.get("amount_gross", 0)),
            squad_reference=str(row.get("squad_ref", "")),
            status=status,
            direction=direction,
            economic_context=_parse_economic_context(row.get("economic_context")),
            tx_metadata={"source": "seeder", "csv_tx_id": str(row.get("tx_id", ""))},
            created_at=ts,
            updated_at=_naive_to_utc(row.get("updated_at")),
        ))

    session.add_all(transactions)
    await session.flush()
    logger.info("seeder.transactions.done", count=len(transactions), skipped=skipped)


async def _seed_ajo_groups(
    session: AsyncSession,
    trader_map: dict[str, str],
) -> None:
    """
    Create one Ajo savings group per unique trader location.
    Adds up to 20 local traders as members.
    """
    logger.info("seeder.ajo_groups.start", path=TRADERS_CSV)
    df = pd.read_csv(TRADERS_CSV)

    # Group CSV trader IDs by location
    loc_traders: dict[str, list[str]] = defaultdict(list)
    for _, row in df.iterrows():
        loc = str(row.get("location", "")).strip()
        if loc and loc.lower() not in ("nan", "none", ""):
            loc_traders[loc].append(str(row["trader_id"]))

    groups_created = 0
    for location, csv_ids in loc_traders.items():
        organizer_uid = trader_map.get(csv_ids[0])
        if not organizer_uid:
            continue

        ajo = Ajo(
            id=str(uuid.uuid4()),
            name=f"{location} Traders Group",
            description=f"Community Ajo savings group for traders in {location}",
            organizer_id=organizer_uid,
            contribution_amount=500000,   # ₦5,000 in kobo
            contribution_frequency="monthly",
            max_members=min(len(csv_ids), 20),
        )
        session.add(ajo)
        await session.flush()

        for order, csv_id in enumerate(csv_ids[:20]):
            uid = trader_map.get(csv_id)
            if uid:
                session.add(AjoMembership(
                    id=str(uuid.uuid4()),
                    ajo_id=ajo.id,
                    user_id=uid,
                    payout_order=order + 1,
                ))

        groups_created += 1

    await session.flush()
    logger.info("seeder.ajo_groups.done", count=groups_created)


# ── Public entry point ────────────────────────────────────────────────────────

async def run_seeder() -> None:
    """
    Main entry point — called once at server startup.
    Loads all CSV data into the database if the users table is empty.
    Never raises: failures are logged and startup continues.
    """
    try:
        async with async_session() as session:
            user_count = await session.scalar(
                select(func.count()).select_from(User.__table__)
            )
            n = int(user_count or 0)
        if n > 0:
            logger.info("seeder.skipped", reason="data already exists", user_count=n)
            # Fresh session so the admin upsert owns its own transaction
            # (the count query above autobegan one on the prior session).
            async with async_session() as admin_session:
                async with admin_session.begin():
                    await _seed_admin_user(admin_session)
            logger.info("seeder.completed", admin_only=True)
            return

        _validate_csv_paths()
        _validate_csv_schema()

        async with async_session() as session:
            async with session.begin():
                logger.info("seeder.start", message="Seeding database from CSV files…")
                trader_map, trader_emails = await _seed_traders(session)
                seeker_map = await _seed_seekers(session, existing_emails=trader_emails)
                await _seed_gigs(session, trader_map, seeker_map)
                await _seed_transactions(session, trader_map, seeker_map)
                await _seed_ajo_groups(session, trader_map)
                await _seed_admin_user(session)
                logger.info("seeder.completed", message="All data seeded successfully")
    except Exception as exc:
        logger.error("seeder.failed", error=str(exc), exc_info=True)


async def _seed_admin_user(session: AsyncSession) -> None:
    """
    Create a default admin user idempotently. Credentials come from settings
    (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_FULL_NAME in .env).

    Idempotency is enforced by checking on the unique `email` column — safe
    to call on every startup.
    """
    from src.models.base import User
    from src.core.security import hash_password
    from src.config import settings

    admin_email = settings.ADMIN_EMAIL.strip().lower()
    admin_password = settings.ADMIN_PASSWORD
    admin_full_name = settings.ADMIN_FULL_NAME

    existing = await session.scalar(
        select(User).where(User.email == admin_email)
    )
    if existing:
        # Ensure existing admin row is usable for login (env may have changed)
        changed = False
        if existing.role != "admin":
            existing.role = "admin"
            changed = True
        if not existing.email_verified:
            existing.email_verified = True
            changed = True
        if existing.is_banned:
            existing.is_banned = False
            existing.ban_reason = None
            changed = True
        if changed:
            logger.info("admin_user_reconciled", email=admin_email)
        return

    admin = User(
        id=str(uuid.uuid4()),
        email=admin_email,
        password_hash=hash_password(admin_password),
        phone=b"",  # Fernet-encrypted in prod; empty placeholder is fine for admin
        role="admin",
        user_type=UserType.SEEKER,
        status=UserStatus.ACTIVE,
        full_name=admin_full_name,
        email_verified=True,   # required so /auth/login does not 403 on EMAIL_NOT_VERIFIED
        profile_complete=True,
        is_banned=False,
        kyc_verified=True,
        squad_provisioned=False,
    )
    session.add(admin)
    await session.flush()

    logger.info(
        "admin_user_created",
        email=admin_email,
        note="Credentials sourced from ADMIN_EMAIL / ADMIN_PASSWORD env vars",
    )

