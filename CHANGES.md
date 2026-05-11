# Zovu — Development Changes Log

> **Audience**: Teammates onboarding to the current codebase state.
> **Last updated**: May 11, 2026

---

## Quick Start (Dev Mode)

### Prerequisites
- Python 3.13 + Anaconda
- Node.js 18+
- No PostgreSQL or Redis needed for dev (SQLite + Redis-optional)

### Backend
```powershell
cd backend
python generate_env.py     # First time only — creates .env with RSA keys + Fernet key
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```
- Runs at **http://localhost:8000**
- SQLite database file auto-created at `backend/data.db` on first run
- All tables are created automatically via `Base.metadata.create_all()` on startup
- Swagger docs at **http://localhost:8000/docs**

### Frontend
```powershell
cd frontend
npm install
npm run dev
```
- Runs at **http://localhost:5173**
- All `/api/*` requests are **proxied** to `http://localhost:8000` via Vite config
- No CORS setup needed in dev

---

## Environment Setup

### `backend/generate_env.py` (NEW FILE)
A one-shot script that generates `backend/.env` for local development.

**What it generates:**
- RSA 2048 key pair for JWT (RS256)
- Fernet encryption key for PII fields (phone, BVN, NIN)
- SQLite DATABASE_URL (no Postgres install needed)
- Placeholder values for Squad/AI APIs

**Run once:**
```powershell
python generate_env.py
```

> In production: set `DATABASE_URL=postgresql+asyncpg://...` and all real API keys.

---

## Backend Changes

### 1. Database: SQLite Support Added (`src/core/database.py`)

**Before:** Always connected to PostgreSQL with pool settings.

**After:** Detects the DB dialect from `DATABASE_URL` at startup:
- **SQLite** (`sqlite+aiosqlite://...`) — uses `StaticPool`, no pool size params
- **PostgreSQL** (`postgresql+asyncpg://...`) — uses full connection pool

```python
# Automatically selects the right engine config:
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
```

No code changes needed when switching from dev (SQLite) to production (PostgreSQL).

---

### 2. Transaction Model: `user_id` Replaced with `sender_id` + `receiver_id` (`src/models/base.py`)

**Before:**
```python
user_id: Mapped[str] = mapped_column(UUID(...), ForeignKey("users.id"))
```

**After:**
```python
sender_id: Mapped[str | None] = mapped_column(UUID(...), ForeignKey("users.id"), nullable=True)
receiver_id: Mapped[str | None] = mapped_column(UUID(...), ForeignKey("users.id"), nullable=True)
```

**Why:** A single `user_id` can't represent the direction of money movement. Every transaction has a source and a destination.

**Direction semantics:**

| Transaction Type    | `sender_id`       | `receiver_id`     |
|---------------------|-------------------|-------------------|
| `CREDIT_DEPOSIT`    | NULL (bank)       | user              |
| `CREDIT_WITHDRAWAL` | user              | NULL (bank)       |
| `LOAN_DISBURSEMENT` | NULL (Zovu system)| borrower          |
| `LOAN_REPAYMENT`    | borrower          | NULL (Zovu system)|
| `AJO_CONTRIBUTION`  | member            | NULL (ajo pool)   |
| `AJO_PAYOUT`        | NULL (ajo pool)   | member            |

**User relationships updated:**
```python
# Before (single relationship):
transactions = relationship("Transaction", back_populates="user")

# After (directional relationships):
sent_transactions = relationship("Transaction", foreign_keys=[Transaction.sender_id], ...)
received_transactions = relationship("Transaction", foreign_keys=[Transaction.receiver_id], ...)
```

---

### 3. Model: `JSONB` Replaced with `JSON` (`src/models/base.py`)

**Before:** `from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB`

**After:** `JSONB` replaced with `JSON` (from `sqlalchemy`) across all models:
- `User.compliance_flags`
- `Ajo.payout_schedule`
- `SquadWebhookLog.payload`
- `Transaction.tx_metadata` (also renamed — see below)

**Why:** `JSONB` is PostgreSQL-only. `JSON` works on both SQLite (dev) and PostgreSQL (prod).

---

### 4. Model: `Transaction.metadata` Renamed to `tx_metadata` (`src/models/base.py`)

**Before:** `metadata = mapped_column(JSONB)`

**After:** `tx_metadata = mapped_column(JSON, name='metadata')`

**Why:** `metadata` is a **reserved attribute** in SQLAlchemy's Declarative API (it references the `MetaData` object). The Python attribute is `tx_metadata` but the database column name remains `metadata`.

**Impact:** Any code reading this field uses `transaction.tx_metadata` instead of `transaction.metadata`.

---

### 5. Redis: Non-Fatal in Development (`src/main.py`)

**Before:** App crashed at startup if Redis was unreachable.

**After:** Redis connection failure is only fatal in `production` mode:
```python
if settings.ENVIRONMENT == "production":
    raise  # Fatal in prod
logger.warning("redis_unavailable_dev_mode", ...)  # Just a warning in dev
```

**Impact:** Backend starts and works in dev even without Redis. JWT blacklisting and rate limiting will be non-functional but all other APIs work.

---

### 6. `get_redis_blacklist_dep` Added (`src/core/redis_client.py`)

**Before:** Function was missing — `auth.py` imported it but it didn't exist.

**After:** Added as an alias for `get_redis_blacklist()`.

---

### 7. Transactions Router Updated (`src/routers/transactions.py`)

**Before:** Filtered transactions by `user_id`.

**After:** Filters by `sender_id OR receiver_id`:
```python
where((Transaction.sender_id == user_id) | (Transaction.receiver_id == user_id))
```

Response now includes `sender_id`, `receiver_id`, and `loan_id`.

---

### 8. Services Updated: `loan.py` and `ajo.py`

Both services now create `Transaction` records with correct `sender_id`/`receiver_id` instead of `user_id`:

- `loan.py` — `LOAN_DISBURSEMENT`: `sender_id=None, receiver_id=loan.user_id`
- `loan.py` — `LOAN_REPAYMENT`: `sender_id=loan.user_id, receiver_id=None`
- `ajo.py` — `AJO_CONTRIBUTION`: `sender_id=membership.user_id, receiver_id=None`
- `ajo.py` — `AJO_PAYOUT`: `sender_id=None, receiver_id=membership.user_id`

---

### 9. KYC Schema: `bvn`/`nin` Made Optional (`src/schemas/auth.py`)

**Before:** Both `bvn` and `nin` were required fields.

**After:** Both are optional, but at least one must be provided:
```python
bvn: Optional[str] = Field(None, min_length=11, max_length=11)
nin: Optional[str] = Field(None, min_length=11, max_length=11)

@validator('nin', always=True)
def at_least_one_id(cls, v, values):
    if not v and not values.get('bvn'):
        raise ValueError('At least one of bvn or nin is required')
    return v
```

**Why:** The frontend collects only one government ID at a time.

---

### 10. KYC Router: Optional Encryption (`src/routers/auth.py`)

```python
# Before (crashed if bvn/nin was None):
bvn_encrypted = encrypt_pii(req.bvn)

# After (safely skips None values):
bvn_encrypted = encrypt_pii(req.bvn) if req.bvn else None
```

---

### 11. `TransactionResponseSchema` Updated (`src/schemas/auth.py`)

Added `sender_id`, `receiver_id`, and `loan_id` fields to the schema so API responses reflect the new model.

---

### 12. Alembic Migration `002` Created (`alembic/versions/002_transaction_sender_receiver.py`)

Migration for when the team switches to PostgreSQL:
- Adds `sender_id` and `receiver_id` columns
- Backfills existing data based on `transaction_type`
- Drops `user_id` column
- Includes clean `downgrade()` to reverse all changes

> **Note for SQLite dev**: Migrations are not needed — `init_db()` creates all tables fresh via `create_all()`.

---

### 13. `requirements.txt` Updated

All packages bumped to Python 3.13-compatible versions:

| Package           | Old       | New       | Why changed              |
|-------------------|-----------|-----------|--------------------------|
| `fastapi`         | 0.111.0   | 0.115.6   | Python 3.13 support      |
| `uvicorn`         | 0.29.0    | 0.34.0    | Python 3.13 support      |
| `sqlalchemy`      | 2.0.30    | 2.0.40    | Bug fixes                |
| `asyncpg`         | 0.29.0    | 0.30.0    | Python 3.13 support      |
| `pydantic`        | 2.7.1     | 2.10.6    | Python 3.13 prebuilt wheel|
| `pydantic-settings`| 2.2.1   | 2.7.0     | Pydantic 2.10 compat     |
| `cryptography`    | 42.0.5    | 44.0.0    | Python 3.13 support      |
| `python-multipart`| 0.0.6     | 0.0.9     | FastAPI 0.115 requirement |
| `aiosqlite`       | (new)     | 0.20.0    | SQLite async driver      |
| `prometheus-fastapi-instrumentator` | (missing) | 7.0.0 | Was imported but not listed |

---

## Frontend Changes

### 14. API Client Created (`src/services/api.ts`) (NEW FILE)

A typed base HTTP client with:
- Automatic `Authorization: Bearer <token>` injection from `localStorage`
- Typed error class `ApiError` with status code and detail
- Generic `get<T>`, `post<T>`, `put<T>`, `delete<T>` helpers
- All requests go to `/api/v1/...` which Vite proxies to the backend

---

### 15. Auth Service Created (`src/services/authService.ts`) (NEW FILE)

Typed wrappers for all auth-related backend endpoints:

| Function              | Endpoint                            | Purpose                         |
|-----------------------|-------------------------------------|---------------------------------|
| `requestOtp()`        | `POST /auth/request-otp`            | Phone OTP for signup            |
| `verifyOtp()`         | `POST /auth/verify-otp`             | Verify OTP, returns JWT tokens  |
| `login()`             | `POST /auth/login`                  | Email+password login            |
| `submitKyc()`         | `POST /auth/kyc`                    | Submit identity verification    |
| `getProfile()`        | `GET /auth/profile`                 | Get current user profile        |
| `logout()`            | `POST /auth/logout`                 | Invalidate token                |
| `saveTokens()`        | localStorage                        | Save access + refresh tokens    |
| `getAccessToken()`    | localStorage                        | Read stored token               |
| `clearTokens()`       | localStorage                        | Clear on logout                 |

Also includes `normalizePhone()` — converts `080...` to `+234...` format.

---

### 16. Vite Proxy Configured (`vite.config.ts`)

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

Meaning: any request from the frontend to `/api/v1/...` is transparently forwarded to the backend. No CORS headers needed. No hardcoded backend URLs in frontend code.

---

### 17. Login Screen Wired to Backend (`src/features/Auth/screens/Login.tsx`)

**Before:** `setTimeout` mock — always succeeded.

**After:**
1. Calls `POST /api/v1/auth/login` with `{ email, password }`
2. On success: saves JWT tokens to `localStorage`, navigates to `/dashboard`
3. On failure: displays the API error message inline under the form
4. Loading state during request disables the submit button

---

### 18. PersonalInfo Screen — OTP Flow (`src/features/Auth/screens/PersonalInfo.tsx`)

**Before:** `setTimeout` mock — saved to sessionStorage and moved on.

**After — Two-phase flow:**

**Phase 1 (Personal Info form):**
1. User fills name, phone, date of birth
2. On submit: calls `POST /api/v1/auth/request-otp` with `{ phone }`
3. Phone is auto-normalized (`080...` → `+234...`)
4. On success: switches UI to OTP input phase

**Phase 2 (OTP verification):**
1. User enters OTP received on phone
2. On submit: calls `POST /api/v1/auth/verify-otp` with `{ phone, otp }`
3. On success: saves JWT tokens to `localStorage`, stores personal data to `sessionStorage`, navigates to next step

---

### 19. FinancialProfile Screen Wired to KYC Endpoint (`src/features/Auth/screens/FinancialProfile.tsx`)

**Before:** `setTimeout` mock — just saved everything to sessionStorage.

**After:**
1. On submit: reads `zovu_personal`, `zovu_role`, `zovu_identity` from `sessionStorage`
2. Combines all data into a KYC payload
3. Calls `POST /api/v1/auth/kyc` with combined personal + identity + financial data
4. On success: clears sessionStorage signup data, navigates to `/signup/success`
5. On failure: displays API error message inline

---

### 20. Dashboard Route Added (`src/App.tsx`)

Added a `/dashboard` route as a placeholder for logged-in users:
```tsx
<Route path="/dashboard" element={<DashboardPlaceholder />} />
```

---

### 21. PostCSS Config Added (`frontend/postcss.config.mjs`) (NEW FILE)

Empty config that overrides a stray `postcss.config.mjs` found at a parent directory level on the developer's machine. Prevents Vite from picking up the wrong PostCSS config.

---

### 22. Date of Birth Field — Four Bugs Fixed

**Files:** `src/index.css`, `src/features/Auth/schemas/personalInfo.schema.ts`, `src/features/Auth/screens/PersonalInfo.tsx`, `src/features/Auth/screens/FinancialProfile.tsx`

| Bug | File | Fix |
|---|---|---|
| Calendar icon invisible on dark background | `index.css` | `color-scheme: dark` + `filter: invert(1)` on `::-webkit-calendar-picker-indicator` |
| No `min`/`max` bounds on picker | `PersonalInfo.tsx` | `max` = 18 years ago, `min` = 100 years ago, computed at module level |
| Age validation used year subtraction only | `personalInfo.schema.ts` | Replaced with exact date comparison: `dob <= new Date(year-18, month, date)` |
| Wrong date format sent to backend | `FinancialProfile.tsx` | Converts `YYYY-MM-DD` → `new Date(val).toISOString()` before KYC call |

---

### 23. OTP Dev Bypass — Auto-Fill From API Response

**Files:** `src/services/authService.ts`, `src/features/Auth/screens/PersonalInfo.tsx`

The backend already returned the OTP in the response body when `DEBUG=true`:
```python
"otp": otp_code_str if settings.DEBUG else None
```

**Before:** Frontend ignored the `otp` field — no way to proceed without a real email service.

**After:**
- `requestOtp` return type updated to include `otp?: string | null`
- If `res.otp` is present, the OTP input is **auto-filled** and an amber dev-mode banner appears:
  > **Dev** — No email service configured — your code is **123456** (pre-filled below)
- In production (`DEBUG=false`), `otp` is `null`, banner is hidden, user enters code from email

No backend changes required — the escape hatch was already there.

---

### 24. Backend — SQLite Datetime Timezone Crash Fixed (`src/services/auth.py`)

**Error:** `can't compare offset-naive and offset-aware datetimes` on every `POST /auth/verify-otp` call.

**Root cause:** SQLite stores datetimes as plain text with no timezone info. SQLAlchemy reads them back as **naive** `datetime` objects (no `tzinfo`). Comparing against `datetime.now(timezone.utc)` — which is **offset-aware** — raises a `TypeError`.

**Fix:** Added a module-level helper:
```python
def _utcnow() -> datetime:
    """Naive UTC datetime — SQLite stores datetimes without timezone info."""
    return datetime.utcnow()
```

Replaced all 6 DB-facing `datetime.now(timezone.utc)` callsites with `_utcnow()`:

| Location | Operation |
|---|---|
| `send_otp` | OTP `expires_at` creation |
| `verify_otp_and_register` | OTP expiry comparison |
| `verify_otp_and_register` | OTP `used_at` write |
| `refresh_access_token` | Refresh token expiry comparison |
| `_generate_tokens` | Refresh token `expires_at` creation |
| `_generate_tokens` | JWT `iat` claim |

> When switching to PostgreSQL in production, this fix remains correct — `datetime.utcnow()` is still valid. If timezone-aware storage is desired in prod, update to `DateTime(timezone=True)` columns and restore `datetime.now(timezone.utc)`.

---

## What Still Needs Work

| Item | Status | Notes |
|---|---|---|
| `RoleInfo.tsx` | sessionStorage only | No backend endpoint for role selection yet |
| `IdentityVerification.tsx` | sessionStorage only | Data passed forward to KYC call |
| Dashboard UI | Placeholder only | Needs full dashboard implementation |
| Redis (JWT blacklisting) | Non-functional in dev | Auth refresh/logout won't invalidate tokens without Redis |
| Email service | Not configured | OTP delivered via API response in dev only; integrate SendGrid/Mailgun for prod |
| Alembic migration `001` | Needs PostgreSQL | Only needed when switching to PostgreSQL for prod |
| Squad payment integration | Placeholder keys | Replace `SQUAD_SECRET_KEY` with real sandbox key |
| AI API keys | Placeholder | Replace `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY` |
