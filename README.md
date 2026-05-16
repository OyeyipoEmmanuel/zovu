# ZOVU — Connect. Work. Grow.

ZOVU is an intelligent economic platform that onboards informal traders and job
seekers in Nigeria, matches workers to gigs via AI embeddings, and builds a
financial identity (the **Pulse Score**) from real behavioural and payment
data. Every money movement runs through **Squad API** — virtual accounts,
transfers, Ajo group savings, microloans and referral bonuses — so the platform
earns a verifiable transaction trail it can underwrite from.

This README is the single source of truth for getting the full stack running
locally. A teammate who has never touched the code should reach a working
browser session in under 15 minutes by following it top to bottom.

---

## Architecture

```
                          ┌────────────────────────────┐
                          │  Browser (React 19 + Vite) │
                          │  http://localhost:5173      │
                          └──────────────┬─────────────┘
                                         │  /api/* proxied
                                         ▼
                          ┌────────────────────────────┐
                          │  FastAPI (uvicorn)         │
                          │  http://localhost:4000      │
                          │  src/main.py · /api/v1/*    │
                          └──────┬───────────────┬─────┘
                                 │               │
                  async SQLAlchemy           async redis-py
                                 │               │
                                 ▼               ▼
              ┌──────────────────────────┐   ┌─────────────┐
              │  PostgreSQL + pgvector   │   │  Redis 7    │
              │  (or SQLite for dev)     │   │  cache +    │
              │  users, gigs, txns,      │   │  rate limit │
              │  ajo, pulse_scores …     │   │  + broker   │
              └──────────────────────────┘   └──────┬──────┘
                                                    │
                                                    ▼
                                        ┌──────────────────────┐
                                        │  Celery workers      │
                                        │  queues: critical /  │
                                        │  default / low       │
                                        │  src/workers/*       │
                                        └──────────┬───────────┘
                                                   │
                  ┌────────────────────────────────┼────────────────────────────────┐
                  ▼                                ▼                                ▼
        ┌──────────────────┐            ┌────────────────────┐          ┌──────────────────┐
        │  Squad API       │            │  OpenAI Whisper    │          │  Anthropic       │
        │  Virtual accts,  │            │  Voice → text      │          │  Claude (NLP +   │
        │  transfers,      │            │  (YO/IG/HA/Pidgin) │          │  financial chat) │
        │  webhooks (HMAC) │            └────────────────────┘          └──────────────────┘
        └──────────────────┘                                                       │
                                                                                   ▼
                                                                         ┌──────────────────┐
                                                                         │  Cohere v3       │
                                                                         │  1024-d multi-   │
                                                                         │  lingual         │
                                                                         │  embeddings      │
                                                                         └──────────────────┘
```

The frontend never calls third-party AI or payment services directly. Every
side-effecting call leaves the request path and runs on a Celery worker, so
HTTP responses stay fast and retryable.

---

## Prerequisites

| Tool             | Version | Required for                                |
|------------------|---------|---------------------------------------------|
| Python           | 3.11+   | Backend / Celery (3.12 used in Docker)      |
| Node.js          | 20+     | Frontend (Vite 8, React 19)                 |
| Docker Desktop   | latest  | Easiest path to run Redis + the API         |
| Git              | latest  | Cloning the repo                            |

Docker is optional — you can run everything on the host if you prefer (see
section 5, Option B), but you will then need a local Redis 7 install.

---

## 1. Clone

```bash
git clone https://github.com/OyeyipoEmmanuel/zovu.git
cd zovu
```

The repo layout is:

```
zovu/
├── backend/          # FastAPI + Celery (Python 3.11+)
├── frontend/         # React 19 + Vite + Tailwind 4
├── AI-engineer/      # CSV seed data + ML notebooks (read-only at runtime)
└── README.md         # This file
```

---

## 2. Environment Setup

Create `backend/.env` by copying the template:

```bash
cp backend/.env.example backend/.env
```

Then fill in the values below. These are the **exact** keys
`backend/src/config.py` reads — leaving a required one blank will crash the app
at startup with a Pydantic validation error.

```env
# ───────────── Database ─────────────
# Dev (SQLite, zero-setup): sqlite+aiosqlite:///./zovu_dev.db
# Prod / Supabase: postgresql+asyncpg://user:password@host:5432/zovu
DATABASE_URL=sqlite+aiosqlite:///./zovu_dev.db
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# ───────────── Redis ─────────────
# Required. Used for cache, rate limits, token blacklist AND as the Celery broker (DB /2).
REDIS_URL=redis://localhost:6379

# Leave these blank — the app derives the broker from REDIS_URL automatically.
CELERY_BROKER_URL=
CELERY_RESULT_BACKEND=

# ───────────── JWT (RS256 asymmetric) ─────────────
# Generate locally:
#   openssl genrsa -out private.pem 2048
#   openssl rsa -in private.pem -pubout -out public.pem
# Paste the PEM contents with literal \n between lines.
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7

# ───────────── Squad API ─────────────
# Get from https://sandbox.squadco.com → Merchant Settings → API & Webhook.
SQUAD_SECRET_KEY=sandbox_sk_xxxxxxxxxxxx
SQUAD_PUBLIC_KEY=sandbox_pk_xxxxxxxxxxxx
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com
SQUAD_WEBHOOK_IP=
# Single merchant virtual account that receives Ajo deposits (optional in dev).
AJO_SQUAD_MERCHANT_ACCOUNT=
SQUAD_MERCHANT_ACCOUNT_NUMBER=

# ───────────── External AI APIs (optional in dev — features degrade gracefully) ─────────────
OPENAI_API_KEY=                  # https://platform.openai.com — Whisper voice
ANTHROPIC_API_KEY=               # https://console.anthropic.com — Claude NLP + chat
COHERE_API_KEY=                  # https://dashboard.cohere.com — multilingual embeddings

# ───────────── PII encryption ─────────────
# Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# If left blank in development the app auto-generates one and logs a warning.
FIELD_ENCRYPTION_KEY=

# ───────────── Application ─────────────
PORT=4000
ENVIRONMENT=development
DEBUG=true
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
SENTRY_DSN=

# ───────────── Email (used for receipts, job-match notifications) ─────────────
EMAIL_PROVIDER=smtp              # smtp | sendgrid
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=noreply@zovu.app
FROM_NAME=Zovu
SENDGRID_API_KEY=

# ───────────── Frontend deep-link URL ─────────────
FRONTEND_URL=http://localhost:5173

# ───────────── Default admin (created idempotently by the seeder) ─────────────
ADMIN_EMAIL=admin@zovu.co
ADMIN_PASSWORD=ZovuAdmin2026!
ADMIN_FULL_NAME=Admin User

# ───────────── Seed data ─────────────
# Absolute path to the AI-engineer/data folder. The Docker compose mounts it for you.
CSV_DATA_DIR=
```

The frontend does **not** need a `.env` file for local development — Vite
proxies `/api/*` to `http://localhost:4000` via `frontend/vite.config.ts`.

---

## 3. Start Infrastructure

The compose file at `backend/docker-compose.yml` ships three services: `api`,
`celery_worker`, and `redis`. Postgres is **not** part of the dev stack — the
API defaults to a SQLite file living in a Docker volume so you have zero local
DB setup.

```bash
cd backend
docker compose up -d redis
```

That brings up just Redis on `localhost:6379`. If you do not have Docker, start
a local `redis-server` instead — anything on port 6379 works.

---

## 4. Database Setup

Schema and seed data are both created **automatically on app startup**:

- `src/main.py` lifespan → `init_db()` runs `Base.metadata.create_all`, creating
  every table and patching any new columns onto an older dev DB.
- The same lifespan hook then calls `run_seeder()` (in `src/core/seeder.py`),
  which loads `AI-engineer/data/*.csv` into the DB if it is empty. The seeder
  is idempotent — re-running it is safe.
- The default admin (`admin@zovu.co` / `ZovuAdmin2026!`) is also created here.

So for a typical local run there is **nothing to do in this section** — just
proceed to section 5.

If you are on PostgreSQL and want to use real Alembic migrations instead of
`create_all`:

```bash
cd backend/alembic
alembic upgrade head
```

(The `alembic.ini` lives inside `backend/alembic/` and points
`script_location = alembic` at the same folder, so the command must be run
from there.)

---

## 5. Run the Backend

### Option A — Docker (recommended)

From `backend/`:

```bash
docker compose up
```

That builds `Dockerfile`, starts the `api` container on
[http://localhost:4000](http://localhost:4000), starts a `celery_worker`
listening on all three queues (`critical,default,low`), and starts `redis`.
Logs stream to your terminal; press Ctrl-C to stop.

### Option B — Manual (on the host)

You need Python 3.11+, a running Redis on port 6379, and the `backend/.env`
file from section 2.

```bash
cd backend
python -m venv venv

# Activate venv
# macOS/Linux:
source venv/bin/activate
# Windows (PowerShell):
venv\Scripts\Activate.ps1

pip install -r requirements.txt

# Run the API
uvicorn src.main:app --host 0.0.0.0 --port 4000 --reload
```

In separate terminals (each with the venv activated) start the Celery workers.
The Procfile defines `worker`, `beat` and `flower`; for development you can
either run a single worker that consumes all three queues, or split them:

```bash
# Single combined worker (simplest):
celery -A src.workers.celery_app worker --loglevel=info -Q critical,default,low

# Or, split into priority queues (matches production):
celery -A src.workers.celery_app worker -Q critical -c 4 --loglevel=info
celery -A src.workers.celery_app worker -Q default  -c 4 --loglevel=info
celery -A src.workers.celery_app worker -Q low      -c 2 --loglevel=info

# Optional: Flower task monitor
celery -A src.workers.celery_app flower    # http://localhost:5555
```

Health-check that the API is up:

```bash
curl http://localhost:4000/health   # → {"status":"ok","environment":"development"}
```

---

## 6. Run the Frontend

In a new terminal, from the repo root:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app on [http://localhost:5173](http://localhost:5173) and
proxies `/api/*` to the backend on `:4000` (configured in
`frontend/vite.config.ts`). Other available scripts in `frontend/package.json`:

| Script             | What it does                                      |
|--------------------|---------------------------------------------------|
| `npm run dev`      | Start the Vite dev server on `:5173`              |
| `npm run build`    | Type-check (`tsc -b`) and produce a `dist/` build |
| `npm run preview`  | Serve the production build locally                |
| `npm run lint`     | Run ESLint over `frontend/`                       |

Sign in with the seeded admin:

- Email: `admin@zovu.co`
- Password: `ZovuAdmin2026!`

Or register a new trader/job-seeker through the onboarding flow.

---

## 7. API Docs

FastAPI auto-generates interactive docs:

- Swagger UI: [http://localhost:4000/docs](http://localhost:4000/docs)
- ReDoc:      [http://localhost:4000/redoc](http://localhost:4000/redoc)
- Health:     [http://localhost:4000/health](http://localhost:4000/health)
- Ready:      [http://localhost:4000/ready](http://localhost:4000/ready)
- Metrics:    [http://localhost:4000/metrics](http://localhost:4000/metrics) (Prometheus format)

All business endpoints live under the `/api/v1/` prefix (see
`backend/src/main.py` for the full router list: auth, users, credit, gigs,
applications, lenders, job_seekers, loans, transactions, ajo, referral,
webhooks, admin, reviews).

---

## 8. Demo Walkthrough

A six-step happy path that exercises the whole stack — useful for a hackathon
demo or a smoke test after pulling new changes.

1. **Register a trader.** Open `http://localhost:5173`, choose "I sell goods or
   services", complete onboarding (voice or manual). On submit, the backend
   provisions a Squad virtual account and seeds the user's Pulse Score row.
2. **Register a job seeker.** In a second browser profile, sign up as a
   seeker. The Celery `low` queue generates a Cohere embedding from the voice
   transcript / skills list.
3. **Post a gig.** As the trader, post a job with skills + price. The backer
   embeds the listing and the matching service ranks seekers via pgvector
   cosine similarity.
4. **Apply and accept.** The seeker sees the gig in their matches feed,
   applies, the trader accepts → escrow state machine moves to `funded`.
5. **Simulate Squad payment.** Fund the trader's virtual account via the
   sandbox simulator (see Squad section below). The webhook hits
   `POST /api/v1/webhooks/squad`, HMAC is verified, the transaction is
   persisted, and the Pulse Score recalc fires asynchronously.
6. **Mark complete.** The trader marks the gig done → Squad transfer to the
   seeker → both Pulse Scores recalculate → the seeker sees the payment in
   `Transactions` and the new score reflected on the dashboard.

---

## 9. Squad API Integration Points

Every money movement and identity event in ZOVU is mediated by Squad. The
queue column shows which Celery queue handles the call.

| Trigger                          | Squad Feature                          | When / Queue                                                                 |
|----------------------------------|----------------------------------------|------------------------------------------------------------------------------|
| User registers                   | Create Virtual Account                 | Sync on `/auth/register`, persists `squad_account_number` on the user        |
| Trader funds escrow              | Virtual Account credit (webhook)       | Squad → `POST /api/v1/webhooks/squad` → `critical` queue                     |
| Gig marked complete              | Transfer (trader → seeker)             | `critical` queue, then Pulse Score recalc on `default` queue                 |
| Loan approved                    | Transfer (lender float → borrower)     | `critical` queue, writes a `loan_disbursement` transaction                   |
| Ajo payout day                   | Transfer (merchant acct → recipient)   | Celery beat scheduled task → `critical` queue                                |
| Referral bonus                   | Transfer (₦500 default)                | `default` queue, idempotent via Redis lock                                   |
| Any Squad webhook                | HMAC-SHA512 verify + idempotency       | Verified in `routers/webhooks.py`, queued to `critical`, returns 200 fast    |

Sandbox testing — fire a credit into a virtual account:

```bash
curl -X POST https://sandbox-api-d.squadco.com/virtual-account/simulate/payment \
  -H "Authorization: Bearer $SQUAD_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"virtual_account_number":"<your-test-VA>","amount":"5000"}'
```

That triggers the full webhook → transaction → Pulse Score recalc loop.

---

## 10. Running Tests

An automated test suite is **not yet in this repo**. For now the smoke tests
are:

```bash
# Backend smoke test — exercises auth + core endpoints
pwsh backend/test-api.ps1            # Windows / PowerShell
# (port from this script to bash if you are on macOS/Linux)

# Frontend type-check + production build (fails on any TS error)
cd frontend && npm run build

# Frontend lint
cd frontend && npm run lint
```

Adding `pytest` to `backend/` and `vitest` to `frontend/` is tracked as a
follow-up. Until then, the demo walkthrough in section 8 is the canonical
end-to-end check.

---

## 11. Team

Add team members here.

- _Name_ — _role_ — _GitHub handle_
- _Name_ — _role_ — _GitHub handle_

---

## Troubleshooting

| Symptom                                                           | Fix                                                                                                          |
|-------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `Redis is required for authentication and sessions` at startup    | Start Redis (`docker compose up -d redis` in `backend/`) and check `REDIS_URL`.                              |
| `FIELD_ENCRYPTION_KEY is required in production`                  | Set `ENVIRONMENT=development` in `.env`, or generate a Fernet key (see the comment in `.env.example`).       |
| Pydantic startup error about missing `JWT_PRIVATE_KEY`            | Generate the RS256 keypair with the openssl commands in section 2 and paste both PEMs into `.env`.           |
| `no such table: users` on the worker                              | The API and worker must point at the same DB. In Docker this is handled by the shared `zovu_sqlite` volume.  |
| CSV seeder logs `FileNotFoundError`                               | Set `CSV_DATA_DIR` in `.env` to an absolute path that resolves to `AI-engineer/data`.                        |
| Frontend can't reach the API                                      | Confirm the API is on `:4000` (`curl http://localhost:4000/health`) — Vite proxies `/api/*` there.           |

---

## License

Proprietary. All rights reserved during the hackathon period.
