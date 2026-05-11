# Zovu — Connect. Work. Grow.

An intelligent economic platform that onboards informal traders and job seekers, matches workers to opportunities via AI, and builds financial identity through behavioural data — powered by Squad API.

---

## Repo Structure

```
zovu/
├── frontend/        # React + Vite + Tailwind (Frontend)
├── backend/         # FastAPI + Python (Backend)
├── types/           # Shared TypeScript types (FE reference)
├── .gitignore
└── README.md
```

---

## Prerequisites

Make sure you have these installed before cloning:

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Python | 3.11+ | `python --version` |
| pip | latest | `pip --version` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 7+ | `redis-cli --version` |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-org/zovu.git
cd zovu
```

---

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

FE runs at → `http://localhost:5173`

**Fill in `frontend/.env.local`:**

```env
VITE_API_URL=http://localhost:8000
```

---

### 3. Backend Setup

Navigate to the [Backend LLD Documentation](#backend-low-level-design) section below for detailed setup and architecture.

Quick start:
```bash
cd backend
python -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env
```

Then follow the detailed backend setup guide below.

BE runs at → `http://localhost:8000`
API docs at → `http://localhost:8000/docs`

---

---

# Backend Low-Level Design

Production-grade backend for Zovu: an intelligent economic platform connecting informal traders and job seekers, powered by FastAPI, PostgreSQL, and Squad API.

**Stack:** FastAPI · PostgreSQL · Redis · Celery · pgvector · Async-first architecture

---

## Backend Table of Contents

- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Development Setup](#backend-development-setup)
- [Core Concepts](#core-concepts)
  - [Authentication & Security](#authentication--security)
  - [Database Design](#database-design)
  - [API Design](#api-design)
- [Services & Workers](#services--workers)
- [Deployment](#deployment)

---

## System Architecture

### Layered Design

```
┌─────────────┐
│   Gateway   │  Nginx (reverse proxy, rate limiting, SSL, IP allowlist)
├─────────────┤
│ API Layer   │  FastAPI · Uvicorn workers · Pydantic v2 validation · JWT middleware
├─────────────┤
│Service Layer│  All business logic (Auth, Credit, Matching, Squad, Fraud, Onboarding)
├─────────────┤
│ Data Layer  │  PostgreSQL (Supabase) · SQLAlchemy 2.0 async · Alembic migrations
├─────────────┤
│Workers      │  Celery + Redis broker (credit recalc, embeddings, webhooks, fraud)
├─────────────┤
│External APIs│  Squad (payments) · OpenAI Whisper · Claude NLP · Cohere embeddings
└─────────────┘
```

### Request Lifecycle

```
Client → Nginx → FastAPI Router → Auth Dependency → Service Layer → DB/Redis → Celery Task
```

**Design Philosophy:**
- Every network call is async (no sync DB calls anywhere)
- Background work always offloaded to Celery → HTTP response returns fast
- Fraud checks run as non-blocking side effects (never in request path)
- Versioned from day 1: all routes under `/api/v1/`

---

## Technology Stack

### Core Framework

| Component | Choice | Why |
|-----------|--------|-----|
| **Web Framework** | FastAPI 0.111+ | Async-native, Pydantic v2 built-in, automatic OpenAPI docs, best Python perf |
| **Server** | Uvicorn + Gunicorn | 4+ workers in production for horizontal scaling |
| **Async DB** | SQLAlchemy 2.0 + asyncpg | Full ORM with type safety, 3–5× faster than psycopg2 for async |
| **Migrations** | Alembic | Code-controlled, team-friendly, CI/CD compatible (not Supabase UI) |
| **Validation** | Pydantic v2 | Rust-core, 5–50× faster than v1, strict mode prevents coercion bugs |

### Security & Authentication

| Component | Choice | Config |
|-----------|--------|--------|
| **Password Hashing** | Argon2id (argon2-cffi) | Winner of Password Hashing Competition; memory-hard, GPU-resistant |
| **Token Signing** | RS256 JWT (python-jose) | Asymmetric — public key verifies without exposing private key |
| **Access Token TTL** | 15 minutes | Stateless, stored in client memory only (never localStorage) |
| **Refresh Token TTL** | 7 days | Opaque UUID, stored server-side, rotated on use, httpOnly cookie |
| **Token Rotation** | Family-based | Stolen token detected on next legitimate use → entire session invalidated |

### Data & Caching

| Component | Choice | Use Case |
|-----------|--------|----------|
| **Primary DB** | PostgreSQL 15 (Supabase) | Relational data + pgvector for embeddings |
| **Vector Extension** | pgvector | Cosine similarity search for job/seeker matching (IVFFlat index) |
| **Cache** | Redis 7 (redis-py async) | Rate limits, token blacklist, credit cache, Celery broker |
| **Async Pool** | asyncpg connection pool | 20 connections, 10 overflow, pre-ping enabled |

### Background Jobs & Messaging

| Component | Choice | Queues |
|-----------|--------|--------|
| **Task Queue** | Celery 5 + Redis broker | 3 queues: `critical`, `default`, `low` with separate workers |
| **Monitoring** | Flower | Dashboard at `/metrics` (restricted access in production) |
| **HTTP Client** | httpx (async) | Never use `requests` — blocks the event loop |

### External APIs & AI

| Service | Purpose | Integration |
|---------|---------|-------------|
| **Squad** | Payments | Virtual accounts, transfers, webhooks (HMAC-SHA512 verified) |
| **OpenAI Whisper** | Voice transcription | Multilingual support (Yoruba, Igbo, Hausa, Pidgin, English) |
| **Anthropic Claude** | NLP extraction & financial assistant | Profile extraction from voice, contextual chat |
| **Cohere v3** | Multilingual embeddings | 1024-dim vectors for job/seeker matching |

### Observability

| Tool | Purpose |
|------|---------|
| **structlog** | JSON-structured logging with request_id, user_id, trace_id |
| **Sentry SDK** | Unhandled exceptions, slow queries, Celery failures |
| **prometheus-fastapi-instrumentator** | Metrics endpoint for Prometheus → Grafana |

---

## Backend Project Structure

```
backend/
├── src/
│   ├── main.py                   # FastAPI app factory & startup
│   ├── config.py                 # Pydantic Settings (environment validation)
│   ├── dependencies.py           # Shared FastAPI deps (get_db, get_current_user)
│   │
│   ├── routers/                  # Thin HTTP layer — only in/out validation
│   │   ├── auth.py              # Login, register, token refresh, logout
│   │   ├── onboard.py           # Voice/manual profile submission
│   │   ├── matches.py           # Job matching & recommendations
│   │   ├── credit.py            # Credit score & history endpoints
│   │   ├── transactions.py      # Transaction history & confirmation
│   │   ├── ajo.py               # Group savings (Ajo/esusu)
│   │   ├── lender.py            # Lender profile & loan offerings
│   │   ├── referral.py          # Referral tracking & payouts
│   │   └── webhooks.py          # Squad webhook receiver
│   │
│   ├── services/                 # All business logic
│   │   ├── auth_service.py      # Password hashing, JWT generation, token rotation
│   │   ├── credit_service.py    # Pulse Score calculation (6 weighted signals)
│   │   ├── squad_service.py     # Virtual account creation, transfers, signature verification
│   │   ├── match_service.py     # Job-seeker matching via pgvector
│   │   ├── onboard_service.py   # Profile extraction via Claude
│   │   ├── ajo_service.py       # Group savings operations
│   │   ├── lender_service.py    # Loan underwriting
│   │   ├── referral_service.py  # Referral tracking
│   │   └── fraud_service.py     # Fraud flag evaluation (non-blocking)
│   │
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── user.py              # User accounts & profiles
│   │   ├── credit.py            # Credit scores & history
│   │   ├── transaction.py       # Squad transactions (partitioned by month)
│   │   ├── job.py               # Job listings & applications
│   │   ├── ajo.py               # Group savings groups & members
│   │   ├── loan.py              # Microloan records
│   │   └── referral.py          # Referral relationships
│   │
│   ├── schemas/                  # Pydantic v2 request/response schemas
│   │   ├── auth.py              # Login, register, token responses
│   │   ├── credit.py            # Credit score response shapes
│   │   ├── job.py               # Job & match schemas
│   │   └── ...
│   │
│   ├── core/
│   │   ├── security.py          # Argon2, JWT, token rotation logic
│   │   ├── redis_client.py      # Async Redis pool + multi-DB routing
│   │   ├── database.py          # SQLAlchemy async engine setup
│   │   ├── exceptions.py        # Custom exception hierarchy
│   │   └── middleware.py        # CORS, rate limiting, request ID tracking
│   │
│   ├── workers/                  # Celery task definitions
│   │   ├── celery_app.py        # Celery app factory
│   │   ├── credit_tasks.py      # Credit recalculation tasks
│   │   ├── embedding_tasks.py   # Cohere embedding generation
│   │   ├── squad_tasks.py       # Squad webhook processing
│   │   └── fraud_tasks.py       # Fraud flag evaluation
│   │
│   └── alembic/                  # Database migrations
│       ├── env.py
│       ├── versions/
│       └── script.py.mako
│
├── requirements.txt
├── .env.example
└── docker-compose.yml
```

---

## Backend Development Setup

### Prerequisites (Backend Only)

```bash
Python 3.11+
PostgreSQL 15+
Redis 7+
```

### 1. Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/zovu
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://localhost:6379

# JWT (generate with: openssl genrsa -out private.pem 2048; openssl rsa -in private.pem -pubout -out public.pem)
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7

# Squad
SQUAD_SECRET_KEY=sandbox_sk_xxxxxxxxxxxxxxxxxxxx
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com

# External APIs
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
COHERE_API_KEY=xxxxxxxxxxxxxxxxxxxx

# PII Encryption (Fernet key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FIELD_ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# App
ENVIRONMENT=development
DEBUG=True
ALLOWED_ORIGINS=["http://localhost:5173"]
SENTRY_DSN=
```

### 2. Virtual Environment & Dependencies

```bash
cd backend
python -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 3. Database Setup

```bash
# Create database
createdb zovu

# Run migrations
alembic upgrade head

# Enable pgvector extension
psql -d zovu -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Start Services

```bash
# Terminal 1: FastAPI dev server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Celery worker (default queue)
celery -A src.workers.celery_app worker -Q default -l info

# Terminal 3: Celery worker (critical queue)
celery -A src.workers.celery_app worker -Q critical -l info

# Terminal 4: Flower monitoring UI
celery -A src.workers.celery_app flower

# Terminal 5: Redis (if running locally)
redis-server
```

**API docs:** http://localhost:8000/docs  
**Flower UI:** http://localhost:5555

---

## Core Concepts

### Authentication & Security

#### Token Architecture

- **Access Token (JWT RS256)** — 15 min TTL, stored in client memory only, stateless, includes `sub` (user_id), `role`, `jti` (for blacklisting), `exp`
- **Refresh Token (Opaque UUID)** — 7 days TTL, stored server-side in `refresh_tokens` table, httpOnly cookie, rotated on every use
- **Token Rotation** — Refresh tokens use family-based invalidation: stealing and using a token before the legitimate user does triggers a family rotation, forcing re-login

#### Rate Limiting (via slowapi)

```
Login / OTP:         5 requests / minute / IP
Register:            3 requests / hour / IP
Token refresh:       10 requests / minute / user
Voice upload:        10 requests / hour / user
General API:         120 requests / minute / user
```

#### Security Controls

- **Password hashing:** Argon2id with time_cost=2, memory_cost=65536 (64MB), parallelism=2 (OWASP minimums)
- **JWT verification:** RS256 asymmetric signing, public key can verify without exposing private key
- **Token blacklist:** Redis `db=1` stores blacklisted JTI tokens with TTL = token remaining lifetime
- **PII encryption:** BVN, NIN, phone numbers encrypted at rest using Fernet (AES-128-CBC)
- **Webhook verification:** Squad webhooks must carry valid HMAC-SHA512 signature
- **CORS:** Strict allowlist (no `*` in production) — only specific origins allowed
- **Security headers:** Nginx enforces HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy

---

### Database Design

#### Key Tables

**users** — Core user records
- `id` (UUID, PK)
- `phone` (unique, indexed for login)
- `phone_verified` (boolean)
- `role` (enum: trader, job_seeker, both, lender)
- `squad_account_id`, `squad_account_number` (Squad virtual account)
- `phone_encrypted`, `bvn_encrypted` (Fernet-encrypted PII)
- `location_lat`, `location_lng` (indexed for geospatial queries)
- Timestamps: `created_at`, `updated_at`

**refresh_tokens** — Session management
- `id` (UUID, PK)
- `user_id` (FK → users)
- `token_hash` (SHA256 of opaque token, indexed, unique)
- `family_id` (UUID for family-based rotation)
- `device_fingerprint` (optional device tracking)
- `expires_at`, `used_at`, `revoked` (boolean)

**seeker_profiles** — Job seekers with embeddings
- `user_id` (UUID, PK/FK → users)
- `skills` (ARRAY of text)
- `availability` (enum: fulltime, parttime, gigs)
- `completion_rate`, `reputation_score` (float)
- `voice_transcript` (text)
- `embedding` (Vector 1024-dim) — Cohere multilingual-v3, indexed with IVFFlat cosine similarity

**credit_scores** — Pulse Score
- `user_id` (UUID, PK/FK → users)
- `score` (0–850 range)
- `tier` (enum: none, bronze, silver, gold, platinum)
- `breakdown` (JSONB of signal weights)
- `microloan_limit`, `savings_eligible`, `insurance_eligible`
- `last_calculated_at` (timestamp)

**credit_score_history** — Audit trail (separate table — don't inflate main row)
- `id`, `user_id`, `score`, `tier`, `recorded_at`

**transactions** — Squad transactions (HIGH-VOLUME, PARTITIONED by month)
- Partitioned range on `created_at` (each month in separate partition)
- `id` (UUID, PK)
- `user_id` (FK → users, indexed with created_at for paginated feed)
- `squad_tx_id` (external reference, unique, indexed)
- `type` (enum: transfer, payment, refund — validated at app layer)
- `amount` (BIGINT — stored in **KOBO**, never naira floats)
- `counterparty`, `metadata` (JSONB)
- Indexes: `(user_id, created_at DESC)` covers paginated queries, `(squad_tx_id)` for idempotency checks

**Important:** Amounts stored as **KOBO** (lowest unit, integer):
- 45000 kobo = ₦450.00
- Prevents floating-point rounding bugs in financial calculations

#### Row Level Security (RLS)

- Enabled on all user-data tables
- Users see only their own data
- Service role (backend) bypasses RLS
- Lenders see only anonymised + explicitly unlocked profiles

#### Key Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| users | `phone` (unique) | O(1) login lookup |
| users | `(location_lat, location_lng)` | Geospatial matching |
| transactions | `(user_id, created_at DESC)` | Paginated feed query covers |
| seeker_profiles | `embedding (ivfflat cosine)` | ANN search for job matches |
| job_listings | `embedding (ivfflat cosine)` | ANN search |
| refresh_tokens | `token_hash` | O(1) token validation |
| credit_score_history | `(user_id, recorded_at)` | 6-month chart queries |

---

### API Design

#### Response Envelope (Consistent across all routes)

Success:
```json
{
  "ok": true,
  "data": { /* payload */ },
  "meta": { "page": 1, "total": 47 }  // only for paginated lists
}
```

Error:
```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_PULSE_SCORE",  // machine-readable
    "message": "Score 287 below 400 required",
    "field": null  // populated for validation errors
  },
  "request_id": "a3b2c1..."
}
```

Pagination (cursor-based, scales to millions):
```json
{
  "ok": true,
  "data": [...],
  "meta": {
    "cursor": "eyJpZCI6...",  // base64-encoded cursor
    "has_more": true,
    "count": 20
  }
}
```

#### Core Routes

**Auth:**
- `POST /api/v1/auth/otp/send` — Send OTP to phone (rate limited 5/min)
- `POST /api/v1/auth/register` — OTP → create user → provision Squad account → issue tokens
- `POST /api/v1/auth/login` — Phone + OTP → JWT pair
- `POST /api/v1/auth/refresh` — Rotate refresh token → new pair
- `POST /api/v1/auth/logout` — Blacklist JWT, delete refresh token

**Onboarding:**
- `POST /api/v1/onboard/voice` — Audio upload → Whisper → Claude extraction → return JSON
- `POST /api/v1/onboard/confirm` — Save profile → queue embedding → mark complete
- `POST /api/v1/onboard/manual` — Text fallback

**Credit:**
- `GET /api/v1/credit/{user_id}` — Score + breakdown (Redis 5min cache)
- `GET /api/v1/credit/{user_id}/history` — Last 6 months

**Jobs:**
- `GET /api/v1/matches/{user_id}` — Top 5 via pgvector (10min cache)
- `POST /api/v1/listings` — Create → queue embedding → notify seekers
- `POST /api/v1/listings/{id}/apply` — Apply → notify employer
- `PATCH /api/v1/applications/{id}/complete` — Mark done → Squad payout → credit recalc

**Webhooks:**
- `POST /api/v1/webhooks/squad` — IP-restricted, signature verified, queued to Celery `critical`

---

## Services & Workers

### Credit Score Service (Most Critical)

**Pulse Score:** 0–850 across 6 weighted signals

```python
WEIGHTS = {
    "tx_frequency":    0.25,  # transaction velocity
    "tx_growth":       0.15,  # trend over 90 days
    "ajo_on_time":     0.25,  # group savings reliability
    "gig_completion":  0.15,  # job completion rate
    "repayment":       0.10,  # loan payback history
    "network_density": 0.10,  # circle of trust
}
```

**Triggered by:**
- Squad webhook (async via Celery)
- Manual admin recalculation
- Celery scheduled tasks (periodic refresh)

**Output:**
- Score + tier written to `credit_scores` table
- History entry appended to `credit_score_history`
- Redis cache invalidated
- Supabase Realtime broadcast to connected clients

### Fraud Detection Service

Non-blocking — runs as Celery low-priority task, never in request path.

**Flags checked:**
- Rapid job posting (>5 jobs/hour)
- Circular payments (same amount 3+ times)
- Score jump (>150 points in 24h)
- Device duplication
- Account age check

**Actions:**
- Soft freeze payouts (no auto-ban — human review)
- Alert support team
- Flag stored in `fraud_flags` table for investigation

### Background Job Queues

**3 Priority Queues:**

| Queue | Max Retries | Timeout | Tasks |
|-------|------------|---------|-------|
| `critical` | 2 | 30s | Squad webhooks, payouts, OTP, fraud soft-freeze |
| `default` | 3 | 60s | Credit recalc, cache invalidation, notifications, referral checks |
| `low` | 5 | 120s | Embeddings, fraud evaluation, analytics, reports |

**Example Task:**
```python
@celery_app.task(
    queue="default",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,  # exponential: 60s, 120s, 240s
    retry_backoff_max=600
)
def recalculate_credit_score(user_id: str):
    # Called after every Squad webhook
    pass
```

**The Squad Webhook → Credit Pipeline:**
```
Squad fires webhook
→ HMAC verify
→ Idempotency check (Redis)
→ Celery critical queue
→ Write transaction
→ Celery default queue
→ Credit recalculation
→ Supabase Realtime broadcast to FE
```

HTTP response returns **200 OK immediately** — Squad doesn't wait for recalc.

---

### Caching Strategy

**Redis Database Allocation:**

| DB | Purpose | Patterns | TTL |
|----|---------|----------|-----|
| 0 | App cache | `credit:{uid}`, `matches:{uid}` | 5–60 min, invalidate on write |
| 1 | Token blacklist + rate limits | `blacklist:{jti}`, `rl:{ip}:{route}`, `otp:{phone}` | = token lifetime |
| 2 | Celery broker | Managed by Celery | Celery manages |
| 3 | Sessions + device FP | `device:{fp}`, `session:{uid}` | 7 days |

**Cache-Aside Pattern:**
```python
# Try cache → miss → DB → populate cache → return
cached = await redis.get(f"credit:{user_id}")
if cached:
    return CreditScore.model_validate_json(cached)

score = await db.get_credit(user_id)
await redis.setex(f"credit:{user_id}", 300, score.model_dump_json())
return score
```

**OTP Storage (Secure):**
- Never stored in plain text
- Hashed with SHA256 before storing in Redis
- 5-minute TTL
- Single-use (deleted on successful verification)

---

### Squad Integration

**Every money movement goes through Squad.**

#### Key Operations

| Trigger | Squad Call | Queue | Result |
|---------|-----------|-------|--------|
| User registers | Create Virtual Account | critical | squad_account_number on user |
| Job marked complete | Transfer to seeker | critical | transaction record → credit signal |
| Loan approved | Transfer to borrower | critical | loan_disbursement tx |
| Ajo payout date | Transfer to recipient | critical | ajo_payout tx |
| Referral bonus | Transfer ₦500 | default | referral_payout tx |
| Squad fires webhook | Receive + verify | → critical Celery | transaction record |

#### Amount Storage

**ALWAYS store in KOBO (lowest unit):**
```python
# 45000 kobo = ₦450.00
amount_kobo: int = 45000
amount_naira = amount_kobo / 100  # Only for display
```

#### Idempotency

Prevent duplicate processing via Redis atomic check-and-set:
```python
lock_key = f"webhook:processed:{squad_tx_id}"
already_processed = await redis.set(lock_key, "1", nx=True, ex=86400)
if not already_processed:
    return  # duplicate — silently ignore
```

---

### AI / ML Pipeline

#### Voice Onboarding

```
Audio (WebM/WAV, <10MB)
→ Whisper transcription (multilingual)
→ Claude NLP extraction (structured JSON)
→ User review & confirm
→ DB save + queue embedding generation
```

**Supported Languages:** Yoruba, Igbo, Hausa, Pidgin, English

#### Embedding Generation (Cohere multilingual-v3)

- 1024-dim vectors
- Supports all Zovu languages
- Indexed with IVFFlat for cosine similarity search
- Queued to Celery `low` priority (5 retries, 120s timeout)

#### Financial AI Assistant

- Stateless conversation (full history sent each turn)
- Context-aware (user's score, tier, language)
- Rate limited: 20 messages/hour/user
- Encourages financial literacy, never gives specific investment advice

---

## Deployment

### Production Checklist

- [ ] All env vars validated at startup (app refuses to start with missing config)
- [ ] `DEBUG=False` in production (disables `/docs`, `/redoc`)
- [ ] pgvector extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Alembic migrations run on startup: `alembic upgrade head` in entrypoint
- [ ] Redis TLS (`rediss://`) + password set
- [ ] Squad webhook IP whitelisted in Nginx
- [ ] Sentry DSN configured
- [ ] HTTPS only (HTTP → HTTPS redirect at Nginx)
- [ ] Database backups scheduled (Supabase + manual `pg_dump` weekly)
- [ ] Flower UI protected with basic auth (not public)

### Docker Services

```yaml
api:
  command: uvicorn src.main:app --host 0.0.0.0 --port 4000 --workers 4

worker-critical:
  command: celery -A src.workers.celery_app worker -Q critical -c 4

worker-default:
  command: celery -A src.workers.celery_app worker -Q default -c 4

worker-low:
  command: celery -A src.workers.celery_app worker -Q low -c 2

flower:
  command: celery flower --broker=<REDIS_URL>

postgres:
  image: pgvector/pgvector:pg15

redis:
  image: redis:7-alpine
```

---

## Key Libraries (requirements.txt)

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pydantic==2.7.1
pydantic-settings==2.2.1
redis[asyncio]==5.0.4
celery==5.4.0
argon2-cffi==23.1.0
python-jose[cryptography]==3.3.0
httpx==0.27.0
tenacity==8.2.3
pgvector==0.2.5
slowapi==0.1.9
structlog==24.1.0
sentry-sdk[fastapi]==2.3.0
cryptography==42.0.5
flower==2.0.1
```

---

## Backend LLD Summary

The backend is production-grade from day 1:
- **Async-first:** Every network call, DB query, and job processing is async — no blocking operations
- **Secure:** Argon2id + RS256 JWT with family-based token rotation, PII encryption, HMAC webhook verification
- **Scalable:** Partitioned transactions table, Redis caching, 3-tier Celery queues, async connection pooling
- **Observable:** Structured JSON logging, Sentry error tracking, Prometheus metrics
- **Squad-native:** Every money movement verified and tracked, idempotency built-in, webhook processing in Celery

See above sections for detailed documentation on architecture, database design, API contracts, authentication, services, and deployment.

---

## Environment Variables — Where to Get Them

| Variable | Where to get it |
|----------|----------------|
| `SQUAD_SECRET_KEY` | [Squad Sandbox Dashboard](https://sandbox.squadco.com) → Merchant Settings → API & Webhook tab |
| `SQUAD_BASE_URL` | Use `https://sandbox-api-d.squadco.com` for dev. Switch to `https://api-d.squadco.com` for production |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) — used for Whisper voice transcription |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) — used for Claude NLP profile extraction |
| `COHERE_API_KEY` | [dashboard.cohere.com](https://dashboard.cohere.com) — used for multilingual embeddings |
| `DATABASE_URL` | Your local PostgreSQL connection string (backend) |
| `SECRET_KEY` | Any random string — used to sign JWTs. Run `openssl rand -hex 32` to generate one |

> **Never commit `.env` or `.env.local` to GitHub.** They are already in `.gitignore`.

---

## Running Both Frontend & Backend at the Same Time

Open two terminals:

**Terminal 1 — Frontend:**
```bash
cd frontend && npm run dev
```

**Terminal 2 — Backend:**
```bash
cd backend && source venv/bin/activate && uvicorn src.main:app --reload
```

---

## Shared Types

The `types/` folder at the root contains all shared TypeScript interfaces used by the FE. BE mirrors these as Pydantic models.

**FE imports types like this:**
```typescript
import type { User, CreditScore, JobMatch } from '../../types'
```

**Rule:** If a type shape changes, announce it in the group chat **before** pushing. Both FE and BE will break silently otherwise.

---

## Squad API — Sandbox Testing

1. Create a sandbox account at [sandbox.squadco.com](https://sandbox.squadco.com)
2. Get your secret key from Merchant Settings → API & Webhook tab
3. Use the simulate payment endpoint to test virtual account funding:

```
POST https://sandbox-api-d.squadco.com/virtual-account/simulate/payment
```

```json
{
  "virtual_account_number": "your-test-account-number",
  "amount": "5000"
}
```

This will fire the webhook and trigger the full transaction → Pulse Score recalculation loop.

---

## Team Rules

- **FE** touches `FE/` only
- **BE** touches `BE/` only
- **DA** writes to `BE/` seed data scripts only
- **Nobody** edits another person's folder
- Any change to `types/` → announce in group chat first
- BE must have stub endpoints live by **end of Day 2**
- FE uses mock data until stubs are live — never block on BE
- One full demo dry-run on **Day 3 evening**
- **Day 4 is polish only** — no new features

---

## Stuck?

Mock it and keep moving. Never wait on another team member.

The only exception: if a type in `types/` is wrong or missing, fix it together immediately — it blocks everyone.