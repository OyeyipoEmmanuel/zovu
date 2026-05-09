# Zovu Backend

FastAPI-based credit and savings platform backend with async SQLAlchemy, Redis, Celery, and Squad API integration.

## Stack

- **Framework**: FastAPI 0.111+ (async only)
- **Database**: PostgreSQL 15 + pgvector (Supabase)
- **ORM**: SQLAlchemy 2.0 async + asyncpg
- **Migrations**: Alembic
- **Cache/Message Broker**: Redis 7
- **Task Queue**: Celery 5 (3 queues: critical, default, low)
- **Security**: Argon2id hashing, RS256 JWT, Fernet encryption
- **External APIs**: Squad (transfers), OpenAI (Whisper), Anthropic (Claude), Cohere (embeddings)
- **Observability**: structlog (JSON structured logging), Sentry, Prometheus metrics

## Setup

### Prerequisites

- Python 3.12+
- PostgreSQL 15
- Redis 7
- Git

### Installation

1. **Clone and enter directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

5. **Generate JWT keys** (if not already done):
   ```bash
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   # Copy the contents of private.pem and public.pem into JWT_PRIVATE_KEY and JWT_PUBLIC_KEY in .env
   ```

6. **Generate Fernet encryption key:**
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   # Copy the output to FIELD_ENCRYPTION_KEY in .env
   ```

7. **Create database migrations:**
   ```bash
   alembic upgrade head
   ```

### Development

**Start development server:**
```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

API documentation: http://localhost:8000/docs

**Start Celery worker** (in separate terminal):
```bash
celery -A src.workers.celery_app worker --loglevel=info
```

**Monitor Celery tasks** (in separate terminal):
```bash
celery -A src.workers.celery_app flower
```
Flower UI: http://localhost:5555

### Docker Compose

**Start all services:**
```bash
docker-compose up -d
```

This starts:
- PostgreSQL 15 + pgvector (localhost:5432)
- Redis 7 (localhost:6379)
- FastAPI app (localhost:8000)
- Celery worker
- Flower (localhost:5555)

**Stop services:**
```bash
docker-compose down
```

## Project Structure

```
backend/
├── src/
│   ├── main.py              # FastAPI app factory with lifespan
│   ├── config.py            # Pydantic Settings (crashes if env vars missing)
│   ├── dependencies.py      # Dependency injection (auth, db, redis)
│   ├── routers/             # THIN HTTP layer (incoming validation → service)
│   ├── services/            # ALL business logic (encrypted, async only)
│   ├── models/              # SQLAlchemy ORM models with indexes
│   ├── schemas/             # Pydantic v2 Request/Response (never expose ORM)
│   ├── core/
│   │   ├── database.py      # Async engine, session factory
│   │   ├── redis_client.py  # 4 logical databases
│   │   ├── security.py      # Argon2id, RS256 JWT, Fernet
│   │   ├── exceptions.py    # Custom exception hierarchy
│   │   └── middleware.py    # CORS, structured logging, error handling
│   └── workers/             # Celery tasks (credit, squad, embedding, fraud)
├── alembic/                 # Database migrations
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
├── docker-compose.yml      # Local development with PostgreSQL + Redis
├── Dockerfile              # Container image
├── Procfile                # Heroku/production process types
└── README.md              # This file
```

## API Routes

All routes under `/api/v1`:

- **Auth**: `/auth` - OTP, register, login, refresh, logout, profile, KYC
- **Credit**: `/credit` - Available balance, max eligible loan, credit status
- **Loans**: `/loans` - Request, list, calculate terms, check eligibility
- **Transactions**: `/transactions` - Ledger (cursor-based pagination)
- **Ajo**: `/ajo` - Create group, join, track contributions
- **Referral**: `/referral` - Generate code, track rewards
- **Webhooks**: `/webhooks/squad` - Squad webhook receiver (idempotency + async processing)

## Database Schema

13 tables with proper indexes and constraints:

- **users**: User accounts, KYC, Pulse Score
- **devices**: Device fingerprints for fraud detection
- **otps**: One-time passwords
- **refresh_tokens**: JWT family-based rotation
- **credits**: Credit accounts (available + reserved balance)
- **loans**: Loan records with repayment tracking
- **transactions**: Ledger (all money movements)
- **jobs**: Employment data for pulse scoring
- **ajos**: Savings groups
- **ajo_memberships**: Ajo member tracking
- **referrals**: Referral rewards
- **pulse_scores**: Score signals and history
- **squad_webhook_logs**: Webhook idempotency

## Key Patterns

### Money Handling
**ALL amounts are in KOBO (integer) — NEVER floats**
```python
45000  # ₦450.00
```

### Token Rotation
Family-based JWT rotation for security:
1. User login → issue access + refresh token (family_id = uuid)
2. Refresh token → new access token + NEW refresh token (same family_id)
3. Multiple old tokens in family immediately revoked if new token issued
4. Logout → invalidate entire token family via blacklist

### Pulse Score (0-850)
```
1. Employment Stability (weight=0.20)
2. Income Score (weight=0.20)
3. Repayment History (weight=0.25)
4. Ajo Participation (weight=0.15)
5. Referral Quality (weight=0.10)
6. Fraud Risk (weight=0.10, inverted)

Total = sum(signal * weight) * 10
```

### Credit Scoring
- Pull-based: Credit line = f(pulse_score, employment, income)
- Max loan eligibility determined by pulse score
- Auto-approved loans if eligible
- Soft-freeze on default (no hard delete)

### Rate Limiting
- Per-endpoint limits in slowapi
- Redis backend (db=1)
- Squad endpoints: strict limits (prevent abuse)

### Idempotency
- Squad webhook idempotency: `Redis SET` with `nx=True` + `ex=86400`
- Prevents duplicate processing on retries

## Security

- **Passwords**: Argon2id (time_cost=2, memory_cost=65536, parallelism=2)
- **Tokens**: RS256 (asymmetric), 15min access + 7day refresh
- **PII**: Encrypted at rest (Fernet) — phone, BVN, NIN
- **Webhook Verification**: HMAC-SHA512 with Squad secret
- **Rate Limiting**: Per-endpoint with Redis backend
- **Token Blacklist**: Redis (db=1) for logout + revocation
- **CORS**: Configurable allowed origins (no wildcard allowed)

## Migrations

Create new migration:
```bash
alembic revision --autogenerate -m "description"
```

Apply migrations:
```bash
alembic upgrade head
```

## Deployment

### Heroku
```bash
git push heroku main
heroku config:set JWT_PRIVATE_KEY="..."
heroku config:set DATABASE_URL="postgresql://..."
heroku config:set REDIS_URL="redis://..."
heroku ps:scale web=1 worker=1
```

### Docker
```bash
docker build -t zovu-backend .
docker run -e DATABASE_URL=... -e REDIS_URL=... -p 8000:8000 zovu-backend
```

## Troubleshooting

**Database connection issues:**
```bash
psql -h localhost -U zovu -d zovu  # Test connection
```

**Redis connection issues:**
```bash
redis-cli ping  # Should return PONG
```

**Alembic migration conflicts:**
```bash
alembic current  # Check current version
alembic history  # See migration history
```

## Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes with type hints and docstrings
3. Run tests (when available)
4. Commit: `git commit -m "feat: description"`
5. Push: `git push origin feature/name`
6. Create pull request

## License

Proprietary — Zovu
