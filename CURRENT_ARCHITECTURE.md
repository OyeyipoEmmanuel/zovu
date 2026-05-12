# Zovu — Current Architecture & Integration Summary

## Overview

You have a **frontend-first setup with mock data** ready to integrate with the backend. The frontend is built and the backend API structure is defined but endpoints aren't fully implemented. Currently running on:
- **Frontend:** `http://localhost:5174` (Vite)
- **Backend:** Defined in `/backend/src/routers/` but not fully connected

---

## 1. USER FLOW: Signup → Dashboard

### Step 1: Landing Page (`/`)
- **Component:** [LandingPage.tsx](frontend/src/features/LandingPage/LandingPage.tsx)
- **UI:** Hero section with "Get Started" and "Join as a Lender" buttons
- **Navigation:** Links to `/signup` and `/signup?role=Lender`
- **No API calls yet** (just static content)

### Step 2: Signup Flow (Multi-Step)
Signup is routed through a multi-step form based on user role:

#### 2a. Personal Info (`/signup` → PersonalInfo screen)
**Component:** [PersonalInfo.tsx](frontend/src/features/Auth/screens/PersonalInfo.tsx)

**Form fields:**
- First Name, Last Name, Middle Name
- Email
- Phone Number
- Password (8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
- Date of Birth (18–100 years old)
- Gender

**On Submit:**
```
1. User clicks "Continue"
2. Validate form with Zod schema
3. API call: requestOtp(email) 
   → Backend: POST /api/v1/auth/request-otp
   → Returns: OTP sent message (+ OTP shown in dev for testing)
4. Show OTP verification input
5. User enters OTP code
6. API call: verifyOtp(email, code, password)
   → Backend: POST /api/v1/auth/verify-otp
   → Returns: { access_token, refresh_token, token_type, expires_in }
7. Tokens saved to localStorage
8. Route to Role Info screen
```

#### 2b. Role Info (`/signup/role-info` → RoleInfo screen)
**Component:** [RoleInfo.tsx](frontend/src/features/Auth/screens/RoleInfo.tsx)

**What happens:**
- Display role-specific questions based on selected role
- If **Trader:** Business type, years trading, daily revenue, registration status
- If **Job Seeker:** Skills, experience level, availability, job type preferences
- **Lender:** Skip to Identity Verification
- **Both:** Both questionnaires

**On Submit:**
- Data stored temporarily (localStorage)
- Route to Identity Verification

#### 2c. Identity Verification (`/signup/identity` → IdentityVerification screen)
**Component:** [IdentityVerification.tsx](frontend/src/features/Auth/screens/IdentityVerification.tsx)

**Form fields:**
- ID Type (National ID, Passport, Driver's License, etc.)
- ID Number
- Issue Date
- Expiry Date
- State of Residence
- LGA (Local Government Area)

**On Submit:**
- Data stored temporarily
- Route to Financial Profile

#### 2d. Financial Profile (`/signup/financial` → FinancialProfile screen)
**Component:** [FinancialProfile.tsx](frontend/src/features/Auth/screens/FinancialProfile.tsx)

**Form fields:**
- Employment Status (Employed, Self-Employed, Student, etc.)
- Income Range (₦0–50K, ₦50K–100K, etc.)
- Primary Financial Goal
- Loan History Status
- Bank Name
- Account Number (for virtual account linkage)

**On Submit:**
```
1. Compile all signup data (PersonalInfo + RoleInfo + Identity + Financial)
2. API call: submitKyc(payload)
   → Backend: POST /api/v1/auth/kyc
   → Backend actions:
      - Create user in DB
      - Provision Squad virtual account
      - Create credit score record (Pulse Score 0)
      - Queue embedding generation (Celery)
   → Returns: { status: "kyc_submitted", message: "..." }
3. Route to SignupSuccess screen
```

#### 2e. Signup Success (`/signup/success` → SignupSuccess screen)
**Component:** [SignupSuccess.tsx](frontend/src/features/Auth/screens/SignupSuccess.tsx)

**Displays:**
- "Welcome to Zovu" message
- Account summary
- "Go to Dashboard" button → Routes to `/dashboard`

---

### Step 3: Login (`/login`)
**Component:** [Login.tsx](frontend/src/features/Auth/screens/Login.tsx)

**Flow:**
```
1. User enters Email + Password
2. API call: login(email, password)
   → Backend: POST /api/v1/auth/login
   → Returns: { access_token, refresh_token, token_type, expires_in }
3. Tokens saved to localStorage
4. Auth store updated with user profile
5. Route to `/dashboard` → automatic redirect based on role
```

---

### Step 4: Dashboard Redirect (`/dashboard`)
**Component:** [App.tsx](frontend/src/App.tsx) → DashboardRouter

**Logic:**
```
const DashboardRouter = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Lender') return <Navigate to="/dashboard/lender" replace />;
  return <Navigate to="/dashboard/trader" replace />;
};
```

---

### Step 5a: Trader Dashboard (`/dashboard/trader`)
**Layout Component:** [TraderLayout.tsx](frontend/src/features/trader/layout/TraderLayout.tsx)

**Main Screen: DashboardHome (`/dashboard/trader`)**
**Component:** [DashboardHome.tsx](frontend/src/features/trader/screens/DashboardHome.tsx)

**Data Loaded on Mount:**
```javascript
const [acct, txnRes, pulse, profile, gigs] = await Promise.all([
  fetchVirtualAccount(),           // Squad virtual account details
  fetchTransactions('all', 1, 5),  // Last 5 transactions
  fetchPulseScore(),               // Credit score + breakdown
  fetchUserProfile(),              // User profile data
  fetchMyGigs(),                   // Posted gigs
]);
```

**Displays:**
- **Top Section:** 
  - Welcome greeting with user name
  - Virtual account number + bank name (copyable)
  - Action buttons: Request Loan, Link Bank Account
  
- **Credit Score Card:**
  - Pulse Score (0–850)
  - Tier (None → Bronze → Silver → Gold → Platinum)
  - Score breakdown (6 signals with percentages)
  - View History link
  
- **Account Balance:**
  - Current balance in Naira
  - "View Breakdown" to see by source
  
- **Recent Transactions Table:**
  - Type (Transfer, Payment, Refund)
  - Amount (in Naira)
  - Counterparty
  - Status (Pending, Completed, Failed)
  - Date/Time
  
- **Active Gigs Section:**
  - Cards showing posted gigs
  - Status (Active, Paused, Completed)
  - Applications count
  
- **KYC Guard Modal (if KYC incomplete):**
  - "Complete your profile" modal blocking dashboard access
  - Routes to `/dashboard/trader/complete-profile/kyc`

**Other Trader Screens:**
- `/dashboard/trader/transactions` — Full transaction history (paginated)
- `/dashboard/trader/pulse` — Credit score details + 6-month history chart
- `/dashboard/trader/gig/post` — Post new gig form
- `/dashboard/trader/payments` — Payment settings
- `/dashboard/trader/settings` — Account settings
- `/dashboard/trader/complete-profile/kyc` — KYC completion form
- `/dashboard/trader/complete-profile/business` — Business details form
- `/dashboard/trader/complete-profile/success` — Completion success

---

### Step 5b: Lender Dashboard (`/dashboard/lender`)
**Component:** [LenderHome.tsx](frontend/src/features/lender/LenderHome.tsx)

**Data Loaded on Mount:**
```javascript
const [statsRes, borrowersRes] = await Promise.all([
  lenderAPI.getStats(),           // Lender stats (disbursed, active, recovered)
  lenderAPI.getBorrowers({ limit: 3 })  // Top 3 borrowers
]);
```

**Displays:**
- **Lender Stats:**
  - Total Disbursed (₦)
  - Active Loans (count)
  - Amount Recovered (₦)
  
- **Available Borrower Pool:**
  - Anonymised borrower cards
  - Credit tier badges
  - Pulse score
  - "View Details" to unlock profile
  
- **My Loans:**
  - Active loans list
  - Disbursement date, due date, repayment progress
  - Status (Active, Repaid, Overdue)

**Other Lender Screens:**
- `/dashboard/lender/borrowers` — Full borrower pool (paginated, searchable)
- `/dashboard/lender/borrowers/:id` — Full borrower profile (unlocked view)
- `/dashboard/lender/loans` — All loans (active + repaid + overdue)
- `/dashboard/lender/settings` — Lender settings

---

## 2. BACKEND RESPONSE STRUCTURE

### Response Envelope Format

All backend responses follow a consistent structure:

#### Success (2xx)
```json
{
  "ok": true,
  "data": { /* payload */ },
  "meta": { "page": 1, "total": 47 }  // only for paginated lists
}
```

#### Error (4xx / 5xx)
```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_PULSE_SCORE",
    "message": "Score 287 below 400 required",
    "field": null  // populated for validation errors
  },
  "request_id": "a3b2c1..."
}
```

#### Pagination (Cursor-based)
```json
{
  "ok": true,
  "data": [...],
  "meta": {
    "cursor": "eyJpZCI6...",
    "has_more": true,
    "count": 20
  }
}
```

---

### Core API Endpoints (Implemented)

#### Auth Routes: `POST /api/v1/auth/*`

| Endpoint | Request | Response | Used By |
|----------|---------|----------|---------|
| `POST /auth/request-otp` | `{ email: string }` | `{ message: string, otp?: string }` | PersonalInfo screen |
| `POST /auth/verify-otp` | `{ email, code, password }` | `{ access_token, refresh_token, token_type, expires_in }` | PersonalInfo screen |
| `POST /auth/login` | `{ email, password }` | `{ access_token, refresh_token, token_type, expires_in }` | Login screen |
| `POST /auth/refresh` | `{ refresh_token }` | `{ access_token, refresh_token, token_type, expires_in }` | Auto-refresh (middleware) |
| `POST /auth/logout` | `{ refresh_token }` | `{ message: string }` | Logout button |
| `POST /auth/kyc` | KycPayload (first_name, last_name, dob, phone, bvn?, nin?) | `{ status, message }` | FinancialProfile screen |
| `GET /auth/me` | — (JWT required) | `{ id, email, first_name, last_name, kyc_verified, pulse_score }` | Profile fetch |

---

#### Credit Routes: `GET /api/v1/credit/*`

| Endpoint | Response | Used By |
|----------|----------|---------|
| `GET /credit/{user_id}` | `{ score: 0–850, tier: string, breakdown: [...signals], microloan_limit }` | DashboardHome, Pulse screen |
| `GET /credit/{user_id}/history` | `[{ score, tier, recorded_at }, ...]` | Pulse history chart |

---

#### Transaction Routes: `GET /api/v1/transactions/*`

| Endpoint | Query Params | Response | Used By |
|----------|-------------|----------|---------|
| `GET /transactions` | `type?`, `page?`, `limit?` | Paginated transaction list | Transactions screen |
| `GET /transactions/{tx_id}` | — | Single transaction details | Transaction detail modal |

---

#### Lender Routes: `GET /api/v1/lender/*`

| Endpoint | Response | Used By |
|----------|----------|---------|
| `GET /lender/stats` | `{ total_disbursed, active_loans, recovered }` | LenderHome |
| `GET /lender/borrowers` | Paginated anonymised borrower list | BorrowerPool screen |
| `GET /lender/borrowers/{id}` | Full borrower profile (unlocked) | BorrowerProfile screen |
| `GET /lender/loans` | Lender's active + repaid + overdue loans | MyLoans screen |

---

## 3. API INTEGRATION: Frontend → Backend

### Architecture

**Two API service files exist:**

#### A. Mock API (`frontend/src/lib/api.ts`) — **CURRENTLY IN USE**
- Uses `USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'`
- Simulates all responses with artificial 400ms delays
- Contains mock data for testing without backend
- **Functions:**
  - `fetchUserProfile()`
  - `fetchVirtualAccount()`
  - `fetchTransactions(type, page, limit)`
  - `fetchPulseScore()`
  - `fetchMyGigs()`
  - `lenderAPI.getStats()`
  - `lenderAPI.getBorrowers()`

#### B. Real API Service (`frontend/src/services/api.ts`) — **READY FOR BACKEND**
```typescript
const BASE_URL = '/api/v1';

const request = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean }
): Promise<T> => {
  // Adds JWT Bearer token to Authorization header
  // Makes real HTTP calls to backend
};

export const api = {
  get: <T>(path: string, auth = true) => ...,
  post: <T>(path: string, body: unknown, auth = false) => ...,
  patch: <T>(path: string, body: unknown, auth = true) => ...,
  delete: <T>(path: string, auth = true) => ...,
};
```

#### C. Auth Service (`frontend/src/services/authService.ts`) — **REAL API CALLS**
```typescript
export const login = (email: string, password: string) =>
  api.post<TokenResponse>('/auth/login', { email, password });

export const requestOtp = (email: string) =>
  api.post<{ message: string }>('/auth/request-otp', { email });

export const verifyOtp = (email: string, code: string, password: string) =>
  api.post<TokenResponse>('/auth/verify-otp', { email, code, password });

export const submitKyc = (payload: KycPayload) =>
  api.post('/auth/kyc', payload, true);  // auth=true (JWT required)

export const getProfile = () =>
  api.get('/auth/me', true);

export const logout = (refresh_token: string) =>
  api.post('/auth/logout', { refresh_token }, true);
```

---

### How Tokens Are Managed

#### Storage
```typescript
// In authService.ts
export const saveTokens = (tokens: TokenResponse): void => {
  localStorage.setItem('zovu_access_token', tokens.access_token);
  localStorage.setItem('zovu_refresh_token', tokens.refresh_token);
};

export const clearTokens = (): void => {
  localStorage.removeItem('zovu_access_token');
  localStorage.removeItem('zovu_refresh_token');
};
```

#### Retrieval (Auto-attached to requests)
```typescript
const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('zovu_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Automatically added to all auth=true requests
if (auth) Object.assign(headers, getAuthHeader());
```

#### Refresh Logic (Not yet implemented)
- Backend returns `expires_in` (15 minutes for access token)
- Frontend should implement auto-refresh before expiry
- Use `/api/v1/auth/refresh` endpoint with `refresh_token`
- **Status:** Ready but not implemented yet (can use mock for now)

---

### State Management (Zustand)

#### Auth Store (`frontend/src/stores/authStore.ts`)
```typescript
interface AuthState {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: 'Trader' | 'Job Seeker' | 'Lender' | 'Both';
    businessName: string;
    profileCompletion: number;        // 0–100%
    kycComplete: boolean;
    squadVaNumber: string | null;
    squadVaBank: string | null;
  } | null;
  token: string | null;
  setUser: (user: ...) => void;
  setToken: (token: ...) => void;
  updateUser: (updates: ...) => void;
  logout: () => void;
}
```
**Used by:** Login flow, Dashboard guards, Profile displays

#### Trader Store (`frontend/src/stores/traderStore.ts`)
```typescript
{
  balance: 0,                        // Account balance in Kobo
  accountNumber: null,               // Squad virtual account
  bankName: null,                    // Bank name
  pulseScore: 0,                     // 0–850
  pulseTier: 'none',                 // Credit tier
  transactions: [],                  // Recent 5 txns
  gigs: [],                          // Posted gigs
  setAccount: (acct) => ...,
  setTransactions: (txns) => ...,
  setPulse: (pulse) => ...,
  setGigs: (gigs) => ...,
}
```
**Used by:** DashboardHome, Transactions screen, Pulse screen

#### Lender Store (`frontend/src/stores/lenderStore.ts`)
```typescript
{
  stats: null,                       // { total_disbursed, active_loans, recovered }
  borrowers: [],                     // Anonymised borrower list
  setStats: (stats) => ...,
  setBorrowers: (borrowers) => ...,
}
```
**Used by:** LenderHome, BorrowerPool, MyLoans

---

## 4. FRONTEND ↔ BACKEND CONNECTION

### Network Flow

```
Frontend                          Backend
─────────────────────────────────────────────
User enters credentials
│
├→ API call (real)
│  POST /api/v1/auth/login
│  headers: { Authorization: Bearer token? }
│
└→ Returns TokenResponse
   { access_token, refresh_token, token_type, expires_in }
   
User navigates to dashboard
│
├→ API call (mock OR real)
│  GET /api/v1/credit/{user_id}
│  headers: { Authorization: Bearer <access_token> }
│
└→ Returns CreditScore
   { score, tier, breakdown, microloan_limit }
```

### Current Status: Mock vs Real

| Feature | Status | Next Step |
|---------|--------|-----------|
| **Auth (Login/Signup)** | ✅ Ready for backend | Connect to real `/auth/*` endpoints |
| **Token storage** | ✅ Implemented | Use real tokens from backend |
| **Dashboard data loading** | 🟡 Mock data | Replace `fetchVirtualAccount()` with real API calls |
| **Transactions** | 🟡 Mock data | Replace `fetchTransactions()` with real API calls |
| **Credit Score** | 🟡 Mock data | Replace `fetchPulseScore()` with real API calls |
| **Token refresh** | ❌ Not implemented | Implement auto-refresh middleware |
| **Error handling** | ✅ Basic | Enhance with proper error messages |

### Environment Variables for Backend Connection

**Frontend `.env.local` (when backend is ready):**
```env
VITE_API_URL=http://localhost:8000    # Backend base URL
VITE_USE_MOCK=false                    # Switch from mock to real API
```

**Current setup uses mock because `VITE_USE_MOCK` defaults to `'false'` (inverted logic).**

---

## 5. WHAT'S READY TO BUILD NEXT

### Phase 1: Backend Endpoints (Priority)
- ✅ Auth routes structure defined
- ❌ Need to implement:
  - OTP service (send via email)
  - User creation with Squad account provisioning
  - JWT token generation
  - KYC data persistence

### Phase 2: Dashboard Data Endpoints
- ❌ Implement:
  - GET `/credit/{user_id}` — Pulse Score calculation
  - GET `/transactions` — Query and paginate transactions
  - GET `/lender/stats` — Lender dashboard stats
  - GET `/lender/borrowers` — Anonymised borrower pool

### Phase 3: Frontend Enhancements
- Implement token refresh middleware
- Add error boundary + proper error messages
- Connect real API when backend ready
- Add loading states + skeletons (partially done)

---

## Summary

**Frontend:** ✅ Fully built with mock data, all screens rendered, state management configured
**Backend:** 🟡 Structure defined, endpoints stubbed, services ready, need implementation
**Connection:** Ready to wire — auth flow can start with backend immediately

Mock data keeps dev fast. When backend is ready, switch `VITE_USE_MOCK=false` and update endpoint calls. No breaking changes needed.
