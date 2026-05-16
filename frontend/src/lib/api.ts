import type { LenderStats, AnonymisedBorrower, FullBorrowerProfile } from '../types/lender';
import { api, refreshAccessToken, API_BASE_URL } from '../services/api';
import { submitKyc as submitKycRequest } from '../services/authService';

// ─── Types ──────────────────────────────────────────────────
export interface Transaction {
  id: string;
  type: 'inflow' | 'outflow';
  counterparty: string;
  amount: number;
  timestamp: string;
  reference: string;
  description: string;
  /** Backend-derived label e.g. "Contribution to Ajo 'Lagos Daily Savers'". */
  purpose?: string;
  /** Display name of the sender, regardless of whether they're the viewer. */
  senderName?: string | null;
  /** Display name of the receiver, regardless of whether they're the viewer. */
  receiverName?: string | null;
  /** Squad reference + a feed-friendly one-liner from the backend. */
  feedLabel?: string;
  status?: string;
}

export interface PulseSignal {
  label: string;
  value: number;
}

export interface PulseHistoryPoint {
  month: string;
  score: number;
}

export interface Gig {
  id: string;
  title: string;
  description: string;
  pay: number;
  payPeriod: 'Per Hour' | 'Per Day' | 'Fixed';
  location: string;
  /** Specific street/site address — surfaced in the seeker's "call trader on arrival" note. */
  directLocation?: string | null;
  /** ISO timestamp of when the trader expects the seeker to start. */
  scheduledAt?: string | null;
  urgency: 'Normal' | 'Urgent';
  skills: string[];
  languages: string[];
  postedAt: string;
  status: 'active' | 'closed';
  /** Trader's id — used to fetch their public rating in listings. */
  traderId?: string;
}

export interface VirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  balance: number;
}

export interface UserProfile {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'trader' | 'job_seeker' | 'partner';
  businessName: string;
  fullName: string;
  companyName: string;
  profileCompletion: number;
  avatarUrl: string | null;
  kycComplete: boolean;
  squadVaNumber: string | null;
  squadVaBank: string | null;
  partnerApproved: boolean;
  pulseScore: number;
}

export interface JobMatch {
  id: string;
  title: string;
  employer: string;
  /** The trader's user id — used to fetch their public rating in listings. */
  trader_id?: string;
  pay: number;
  pay_period: string;
  lga: string;
  match_pct: number;
  match_reasons: string[];
  skills_required: string[];
  posted: string;
  urgent: boolean;
  applied: boolean;
  /** Optional street address surfaced when applying to a gig. */
  direct_location?: string | null;
  /** ISO timestamp of when the trader expects the seeker to start. */
  scheduled_at?: string | null;
}

export interface GigRecord {
  id: string;
  title: string;
  employer: string;
  date: string;
  pay: number;
  duration: string;
  status: 'completed' | 'cancelled';
  rating: number | null;
  review: string | null;
}

export interface JSTransaction {
  id: string;
  type: 'inflow' | 'outflow';
  counterparty: string;
  amount: number;
  timestamp: string;
  reference: string;
  description: string;
  /** Phase-1 enrichment fields. */
  purpose?: string;
  senderName?: string | null;
  receiverName?: string | null;
  feedLabel?: string;
  status?: string;
}

export interface JSNotification {
  id: string;
  type: 'job' | 'payment' | 'score';
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

export interface MyLoanRecord {
  borrower_name: string;
  amount: number;
  disbursed_at: string;
  repayment_days: number;
  due_date: string;
  amount_repaid: number;
  total_repayment: number;
  status: 'active' | 'repaid' | 'overdue';
  transaction_ref: string;
}

export interface MyLoanStats {
  total_disbursed: number;
  active_loans: number;
  recovered: number;
}

export interface InsuranceServiceRecord {
  id: string;
  type: 'insurance';
  customer_name: string;
  product_name: string;
  monthly_premium: number;
  coverage_amount: number;
  next_deduction: string;
  status: 'active' | 'cancelled' | 'overdue';
}

export interface PartnerStats {
  total_disbursed: number;
  active_services: number;
  customers_served: number;
}

export interface AjoGroup {
  id: string;
  name: string;
  description: string | null;
  minimum_deposit: number;
  end_date: string | null;
  total_balance: number;
  member_count: number;
  status: string;
  joined: boolean;
  total_contributed?: number;
  estimated_return?: number;
  merchant_squad_account?: string | null;
}

export interface AjoTransaction {
  id: string;
  ajo_id: string;
  ajo_name: string;
  amount: number;
  type: 'contribution' | 'payout';
  status: string;
  timestamp: string;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('zovu_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const isRefreshableAuthRoute = (path: string): boolean =>
  path === '/auth/refresh' ||
  path === '/auth/login' ||
  path === '/auth/register' ||
  path === '/auth/verify-otp' ||
  path === '/auth/resend-otp';

const rawFetchOnce = async (
  path: string,
  init: RequestInit,
  auth: boolean,
): Promise<Response> => {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  if (auth) Object.assign(headers, getAuthHeader());
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
};

/** Legacy JSON fetch for non-envelope routes (credit, loans, transactions). */
const rawV1 = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> => {
  const { auth = true, ...init } = options;

  let res = await rawFetchOnce(path, init, auth);

  if (res.status === 401 && auth && !isRefreshableAuthRoute(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await rawFetchOnce(path, init, auth);
    }
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string; code?: string } | undefined;
    const detail = data.detail as string | { msg?: string }[] | undefined;
    const msg =
      err?.message ??
      (typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? String(detail[0]?.msg ?? detail)
          : (data.message as string) ?? 'Request failed');
    throw new ApiError(res.status, msg);
  }
  if (data && data.ok === false) {
    const err = data.error as { message?: string } | undefined;
    throw new ApiError(res.status, err?.message ?? 'Request failed');
  }
  return data as T;
};

function unwrapOkData<T>(body: Record<string, unknown>): T {
  if (body && body.ok === true && 'data' in body) return body.data as T;
  return body as T;
}

const v1OkData = async <T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> => {
  const body = await rawV1<Record<string, unknown>>(path, init);
  return unwrapOkData<T>(body);
};

interface AuthMeResponse {
  id: string;
  email: string;
  role?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  squad_account_number?: string | null;
  squad_account_bank?: string | null;
  pulse_score?: number;
  kyc_verified?: boolean;
  profile_complete?: boolean;
  partner_approved?: boolean;
}

interface CreditStatusResponse {
  available_balance: number;
  reserved_balance: number;
  total_balance: number;
  max_eligible_loan: number;
  status: string;
}

interface TxnListItem {
  id: string;
  direction: string;
  amount: number;
  created_at: string;
  squad_reference?: string | null;
  transaction_type?: string;
  feed_label?: string;
  // Phase-1 enrichment fields from /api/v1/transactions
  sender_id?: string | null;
  sender_name?: string | null;
  receiver_id?: string | null;
  receiver_name?: string | null;
  counterparty_display?: string | null;
  counterparty_id?: string | null;
  purpose?: string | null;
  status?: string | null;
}

let meCache: { at: number; me: AuthMeResponse } | null = null;
const ME_TTL_MS = 2500;

const getAuthMeCached = async (): Promise<AuthMeResponse> => {
  const now = Date.now();
  if (meCache && now - meCache.at < ME_TTL_MS) return meCache.me;
  const me = await api.get<AuthMeResponse>('/auth/me', true);
  meCache = { at: now, me };
  return me;
};

export const invalidateAuthMeCache = (): void => {
  meCache = null;
};

const getPulseTier = (score: number): string => {
  if (score >= 700) return 'Gold';
  if (score >= 400) return 'Silver';
  return 'Bronze';
};

const mapMeToUserProfile = (me: AuthMeResponse): UserProfile => {
  const kycDone = Boolean(me.kyc_verified);
  const profileDone = Boolean(me.profile_complete);
  const completion = profileDone ? 100 : kycDone ? 85 : 60;
  const rawRole = (me.role || '').toLowerCase();
  const role: UserProfile['role'] =
    rawRole === 'job_seeker' || rawRole === 'seeker'
      ? 'job_seeker'
      : rawRole === 'partner' || rawRole === 'lender'
        ? 'partner'
        : 'trader';
  return {
    id: me.id,
    firstName: me.first_name?.trim() || '',
    lastName: me.last_name?.trim() || '',
    email: me.email,
    role,
    businessName: (me.business_name || '').trim(),
    fullName: (me.full_name || '').trim(),
    companyName: (me.company_name || '').trim(),
    profileCompletion: completion,
    avatarUrl: null,
    kycComplete: kycDone,
    squadVaNumber: me.squad_account_number ?? null,
    squadVaBank: me.squad_account_bank ?? null,
    partnerApproved: Boolean(me.partner_approved),
    pulseScore: Number(me.pulse_score ?? 0),
  };
};

const mapTxnRow = (row: TxnListItem): Transaction => {
  // Prefer the backend's resolved counterparty display name; fall back to the
  // raw transaction-type label so older clients keep working.
  const counterparty =
    row.counterparty_display ||
    (row.direction === 'inflow' ? row.sender_name : row.receiver_name) ||
    row.feed_label ||
    String(row.transaction_type || 'Transaction').replace(/_/g, ' ');

  // The backend now sends a human-friendly purpose for every row.
  // Fall back to the transaction_type so the description column is never empty.
  const purpose = row.purpose || String(row.transaction_type || '').replace(/_/g, ' ');

  return {
    id: row.id,
    type: row.direction === 'inflow' ? 'inflow' : 'outflow',
    counterparty,
    amount: Math.round((row.amount ?? 0) / 100),
    timestamp: row.created_at,
    reference: row.squad_reference || row.id,
    description: purpose,
    purpose,
    senderName: row.sender_name ?? null,
    receiverName: row.receiver_name ?? null,
    feedLabel: row.feed_label,
    status: row.status ?? undefined,
  };
};

const mapBackendGigToGig = (g: Record<string, unknown>): Gig => {
  const payKobo = Number(g.amount ?? 0);
  const period = String(g.payment_period || 'Per Day');
  const payPeriod: Gig['payPeriod'] =
    period.toLowerCase().includes('hour')
      ? 'Per Hour'
      : period.toLowerCase().includes('fixed')
        ? 'Fixed'
        : 'Per Day';
  const skillsRaw = String(g.skill_required || '');
  const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const st = String(g.status || '').toLowerCase();
  const status: Gig['status'] = st === 'closed' || st === 'cancelled' ? 'closed' : 'active';
  return {
    id: String(g.id),
    title: String(g.title || ''),
    description: String(g.description || ''),
    pay: Math.round(payKobo / 100),
    payPeriod,
    location: String(g.location || ''),
    urgency: 'Normal',
    skills,
    languages: [],
    postedAt: String(g.created_at || new Date().toISOString()),
    status,
    directLocation: typeof g.direct_location === 'string' ? g.direct_location : null,
    scheduledAt: typeof g.scheduled_at === 'string' ? g.scheduled_at : null,
    traderId: typeof g.trader_id === 'string' ? g.trader_id : undefined,
  };
};

const mapJobRow = (row: Record<string, unknown>): JobMatch => ({
  id: String(row.id),
  title: String(row.title || ''),
  employer: String(row.employer || ''),
  trader_id: typeof row.trader_id === 'string' ? row.trader_id : undefined,
  pay: Math.round(Number(row.pay ?? 0) / 100),
  pay_period: String(row.pay_period || 'gig'),
  lga: String(row.lga || row.location || ''),
  match_pct: Number(row.match_pct ?? 0),
  match_reasons: Array.isArray(row.match_reasons) ? (row.match_reasons as string[]) : [],
  skills_required: Array.isArray(row.skills_required) ? (row.skills_required as string[]) : [],
  posted: String(row.created_at || row.posted || new Date().toISOString()),
  urgent: Boolean(row.urgent),
  applied: Boolean(row.applied),
  direct_location: typeof row.direct_location === 'string' ? row.direct_location : null,
  scheduled_at: typeof row.scheduled_at === 'string' ? row.scheduled_at : null,
});

// ─── User ──────────────────────────────────────────────────
export const fetchUserProfile = async (): Promise<UserProfile> => {
  const me = await getAuthMeCached();
  return mapMeToUserProfile(me);
};

// ─── Virtual Account ───────────────────────────────────────
export const fetchVirtualAccount = async (): Promise<VirtualAccount> => {
  const [me, credit] = await Promise.all([
    getAuthMeCached(),
    rawV1<CreditStatusResponse>('/credit/status', { method: 'GET' }),
  ]);
  const label =
    (me.business_name && me.business_name.trim()) ||
    [me.first_name, me.last_name].filter(Boolean).join(' ').trim() ||
    me.full_name?.trim() ||
    me.email;
  return {
    accountNumber: me.squad_account_number || '',
    accountName: `${label.toUpperCase()} / ZOVU`,
    bankName: me.squad_account_bank || 'Squad',
    balance: Math.round((credit.total_balance ?? 0) / 100),
  };
};

// ─── Transactions ──────────────────────────────────────────
export const fetchTransactions = async (
  filter: 'all' | 'inflow' | 'outflow' = 'all',
  _page = 1,
  limit = 15,
  cursor?: string | null
): Promise<{ data: Transaction[]; total: number; cursor?: string | null; has_more?: boolean }> => {
  const fetchLimit = filter === 'all' ? limit : Math.min(100, limit * 5);
  const qs = new URLSearchParams({ limit: String(fetchLimit) });
  if (cursor) qs.set('cursor', cursor);
  const res = await rawV1<{
    items: TxnListItem[];
    total: number;
    cursor: string | null;
    has_more: boolean;
  }>(`/transactions?${qs.toString()}`, { method: 'GET' });
  let rows = (res.items || []).map(mapTxnRow);
  if (filter !== 'all') rows = rows.filter((t) => t.type === filter);
  rows = rows.slice(0, limit);
  return {
    data: rows,
    total: rows.length,
    cursor: res.cursor ?? null,
    has_more: Boolean(res.has_more),
  };
};

// ─── Pulse Score ───────────────────────────────────────────
export const fetchPulseScore = async (): Promise<{
  score: number;
  maxScore: number;
  tier: string;
  loanEligibility: number;
  signals: PulseSignal[];
}> => {
  const [me, credit, signalsRes] = await Promise.all([
    getAuthMeCached(),
    rawV1<CreditStatusResponse>('/credit/status', { method: 'GET' }),
    v1OkData<{ signals: PulseSignal[] }>('/credit/pulse-signals', { method: 'GET' }).catch(() => ({ signals: [] })),
  ]);
  const score = me.pulse_score ?? 0;
  return {
    score,
    maxScore: 850,
    tier: getPulseTier(score),
    loanEligibility: Math.round((credit.max_eligible_loan ?? 0) / 100),
    signals: signalsRes?.signals ?? [],
  };
};

export const fetchPulseHistory = async (): Promise<PulseHistoryPoint[]> => {
  const data = await v1OkData<PulseHistoryPoint[]>('/credit/pulse-history', { method: 'GET' }).catch(() => []);
  return Array.isArray(data) ? data : [];
};

// ─── Gigs ──────────────────────────────────────────────────
export const postGig = async (
  gig: Omit<Gig, 'id' | 'postedAt' | 'status'>
): Promise<Gig> => {
  const body: Record<string, unknown> = {
    title: gig.title,
    description: gig.description,
    skill_required: gig.skills.length ? gig.skills.join(', ') : 'General',
    location: gig.location,
    amount: Math.max(1, Math.round(gig.pay * 100)),
    payment_period: gig.payPeriod,
  };
  if (gig.directLocation && gig.directLocation.trim()) {
    body.direct_location = gig.directLocation.trim();
  }
  if (gig.scheduledAt) {
    body.scheduled_at = gig.scheduledAt;
  }
  const created = await v1OkData<Record<string, unknown>>('/gigs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapBackendGigToGig(created);
};


// ─── Reviews ──────────────────────────────────────────────
export interface ReviewItem {
  id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  reviewer_role: 'trader' | 'seeker' | string;
  reviewee_id: string;
  gig_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewAggregate {
  user_id: string;
  review_count: number;
  average_rating: number;
  reviews?: ReviewItem[];
}

export const fetchUserReviews = async (userId: string, limit = 20): Promise<ReviewAggregate> => {
  return await v1OkData<ReviewAggregate>(`/reviews/users/${userId}?limit=${limit}`, { method: 'GET' });
};

export const fetchUserRatingAggregate = async (userId: string): Promise<ReviewAggregate> => {
  return await v1OkData<ReviewAggregate>(`/reviews/users/${userId}/aggregate`, { method: 'GET' });
};

export const canReviewGig = async (gigId: string): Promise<{
  allowed: boolean;
  reason?: string;
  reviewee_id?: string;
  role?: 'trader' | 'seeker';
}> => {
  return await v1OkData(`/reviews/can-review?gig_id=${encodeURIComponent(gigId)}`, { method: 'GET' });
};

export const submitReview = async (input: {
  gig_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
}): Promise<ReviewItem> => {
  return await v1OkData<ReviewItem>('/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  });
};

export const fetchMyGigs = async (): Promise<Gig[]> => {
  const list = await v1OkData<Record<string, unknown>[]>('/gigs/my-gigs', { method: 'GET' });
  return Array.isArray(list) ? list.map(mapBackendGigToGig) : [];
};

// ─── Gig Applicants (Trader) ────────────────────────────────
export interface GigApplicant {
  id: string;            // application id
  gig_id: string;
  seeker_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  applied_at: string;
  seeker: {
    id: string;
    display_name: string;
    email: string;
    pulse_score: number;
    location: string;
    skills: string[];
    languages: string[];
    completion_rate: number;
    kyc_verified: boolean;
    squad_account_number: string | null;
    squad_account_bank: string | null;
  };
  gig?: {
    id: string;
    title: string;
    location: string;
    amount: number;
    status: string;
  };
}

export const fetchGigApplicants = async (gigId: string): Promise<GigApplicant[]> => {
  const rows = await v1OkData<GigApplicant[]>(`/gigs/${gigId}/applicants`, { method: 'GET' });
  return Array.isArray(rows) ? rows : [];
};

export const fetchAllMyApplicants = async (): Promise<GigApplicant[]> => {
  const rows = await v1OkData<GigApplicant[]>('/gigs/my-applicants', { method: 'GET' });
  return Array.isArray(rows) ? rows : [];
};

export const acceptApplicant = async (gigId: string, applicationId: string) =>
  v1OkData<Record<string, unknown>>(`/gigs/${gigId}/accept/${applicationId}`, {
    method: 'POST',
    body: '{}',
  });

// ─── Public Gigs (no auth required) ────────────────────────
export const fetchPublicGigs = async (params: {
  search?: string;
  location?: string;
  limit?: number;
} = {}): Promise<Gig[]> => {
  const qs = new URLSearchParams();
  if (params.search) qs.set('skill', params.search);
  if (params.location) qs.set('location', params.location);
  qs.set('limit', String(params.limit ?? 24));
  const list = await v1OkData<Record<string, unknown>[]>(`/gigs?${qs.toString()}`, {
    method: 'GET',
    auth: false,
  });
  return Array.isArray(list) ? list.map(mapBackendGigToGig) : [];
};

// ─── Squad / Payments ──────────────────────────────────────
export const squadDeposit = async (amountNaira: number, callbackUrl: string) =>
  v1OkData<{ transaction_id: string; squad_reference: string; checkout_url: string; amount_kobo: number; status: string }>(
    '/transactions/squad/deposit',
    {
      method: 'POST',
      body: JSON.stringify({
        amount_kobo: Math.round(amountNaira * 100),
        callback_url: callbackUrl,
      }),
    },
  );

export const squadPaySeeker = async (
  seekerId: string,
  amountNaira: number,
  options?: { gig_id?: string; narration?: string },
) =>
  v1OkData<{
    transaction_id: string;
    squad_reference: string;
    status: string;
    amount_kobo: number;
    seeker_id: string;
    seeker_account: string;
  }>('/transactions/squad/transfer-to-seeker', {
    method: 'POST',
    body: JSON.stringify({
      seeker_id: seekerId,
      amount_kobo: Math.round(amountNaira * 100),
      gig_id: options?.gig_id,
      narration: options?.narration,
    }),
  });

// ─── Services Marketplace (approved partners only) ──────────
export interface PartnerServiceListing {
  id: string;
  lender_id: string;
  name: string;
  type: 'loan' | 'insurance';
  description: string | null;
  min_pulse_score: number;
  max_amount: number | null;       // kobo
  interest_rate: number | null;
  premium_amount: number | null;   // kobo
  repayment_days: number | null;
  status: string;
  lender: { id: string; company_name: string; email: string };
}

export const fetchPartnerServicesMarketplace = async (
  filters?: { type?: 'loan' | 'insurance'; minPulseScore?: number },
): Promise<PartnerServiceListing[]> => {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.minPulseScore != null) params.set('min_pulse_score', String(filters.minPulseScore));
  const q = params.toString();
  const rows = await v1OkData<PartnerServiceListing[]>(`/lenders/services-marketplace${q ? `?${q}` : ''}`, {
    method: 'GET',
  });
  return Array.isArray(rows) ? rows : [];
};

// ─── Complaints ────────────────────────────────────────────
export interface ComplaintRecord {
  id: string;
  transaction_id: string;
  category: string;
  description: string;
  status: string;
  urgency: string;
  resolution: string | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const fileComplaint = async (payload: {
  transaction_id: string;
  category: string;
  description: string;
  urgency?: 'low' | 'medium' | 'high';
}): Promise<ComplaintRecord> =>
  v1OkData<ComplaintRecord>('/admin/complaints', {
    method: 'POST',
    body: JSON.stringify({ urgency: 'medium', ...payload }),
  });

export const fetchMyComplaints = async (): Promise<ComplaintRecord[]> => {
  const rows = await v1OkData<ComplaintRecord[]>('/admin/complaints/mine', { method: 'GET' });
  return Array.isArray(rows) ? rows : [];
};

// ─── Payments ──────────────────────────────────────────────
export const fetchRecentPayments = async (): Promise<
  { id: string; sender: string; amount: number; timestamp: string }[]
> => {
  const { data } = await fetchTransactions('inflow', 1, 8);
  return data.map((t) => ({
    id: t.id,
    sender: t.counterparty,
    amount: t.amount,
    timestamp: t.timestamp,
  }));
};

// ─── KYC & Profile ───────────────────────────────────────────
export interface SubmitKYCResult {
  kyc_complete: boolean;
  squad_provisioned: boolean;
  squad_va_number: string;
  squad_va_bank: string;
}

export const submitKYC = async (
  data: Record<string, unknown>
): Promise<SubmitKYCResult> => {
  const dobRaw = typeof data.dob === 'string' ? data.dob : '';
  let date_of_birth = dobRaw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
    date_of_birth = `${dobRaw}T00:00:00Z`;
  } else if (dobRaw.includes('/')) {
    const [m, d, y] = dobRaw.split('/');
    if (y && m && d) date_of_birth = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`;
  }

  const fullName = (data.full_name as string | undefined)?.trim() || '';
  const fullParts = fullName ? fullName.split(/\s+/) : [];
  const first =
    (data.first_name as string | undefined)?.trim() ||
    fullParts[0] ||
    (data.middle_name as string | undefined) ||
    'User';
  const last =
    (data.last_name as string | undefined)?.trim() ||
    (fullParts.length > 1 ? fullParts.slice(1).join(' ') : '') ||
    first;

  const rawPhone = (data.phone as string | undefined)?.trim() || '';
  if (!rawPhone) {
    throw new Error('Phone number is required for KYC');
  }

  const kyc = await submitKycRequest({
    first_name: first,
    last_name: last,
    middle_name: (data.middle_name as string | undefined) || undefined,
    date_of_birth,
    phone: rawPhone,
    bvn: (data.bvn as string | undefined) || undefined,
    nin: (data.nin as string | undefined) || undefined,
    gender: (data.gender as '1' | '2' | undefined) || undefined,
    address: (data.address as string | undefined) || undefined,
  });

  invalidateAuthMeCache();

  let accountNumber = (kyc.account_number || '').trim();
  let accountBank = (kyc.bank || '').trim();
  let kycComplete = Boolean(kyc.kyc_verified);
  let provisioned = Boolean(kyc.squad_provisioned);

  if (!accountNumber || !accountBank) {
    const me = await getAuthMeCached().catch(() => null);
    if (me) {
      accountNumber = accountNumber || me.squad_account_number || '';
      accountBank = accountBank || me.squad_account_bank || '';
      kycComplete = kycComplete || Boolean(me.kyc_verified);
    }
  }

  return {
    kyc_complete: kycComplete,
    squad_provisioned: provisioned,
    squad_va_number: accountNumber,
    squad_va_bank: accountBank,
  };
};

export const submitBusinessInfo = async (_data: unknown): Promise<{ success: boolean }> => {
  return { success: true };
};

export const fetchKYCStatus = async (): Promise<{ kyc_complete: boolean; squad_va_number: string | null }> => {
  const me = await getAuthMeCached();
  return {
    kyc_complete: Boolean(me.kyc_verified),
    squad_va_number: me.squad_account_number ?? null,
  };
};

// ─── Loans ─────────────────────────────────────────────────
export const applyForLoan = async (data: {
  amount: number;
  purpose: string;
  repayment_period: string;
}): Promise<{ success: boolean }> => {
  const map: Record<string, 7 | 14 | 30 | 60> = {
    '7': 7,
    '14': 14,
    '30': 30,
    '60': 60,
    '90': 60,
  };
  const tenure = map[data.repayment_period] ?? 30;
  await rawV1('/loans/request', {
    method: 'POST',
    body: JSON.stringify({
      principal_amount: Math.round(data.amount * 100),
      tenure_days: tenure,
    }),
  });
  void data.purpose;
  return { success: true };
};

export const fetchMyApplications = async (): Promise<unknown[]> => {
  const res = await rawV1<{ loans: unknown[] }>('/loans');
  return res.loans ?? [];
};

export const lenderProfileAPI = {
  step1: (payload: {
    organization_name: string;
    account_type: 'individual' | 'microfinance' | 'cooperative' | 'fintech' | 'insurance';
    phone: string;
  }) => api.post<{ success: boolean }>('/lenders/profile/step1', payload, true),

  step2Individual: (payload: {
    bvn: string;
    nin: string;
    dob: string;
    gender: '1' | '2';
  }) => api.post<{ success: boolean }>('/lenders/profile/step2-individual', payload, true),

  step2Organization: (payload: {
    cac_number: string;
    organization_bvn: string;
    year_established: number;
  }) => api.post<{ success: boolean }>('/lenders/profile/step2-organization', payload, true),

  step3: (payload: {
    bank_name: string;
    account_number: string;
    account_name: string;
    min_lending_amount: number;
    max_lending_amount: number;
    preferred_tiers: string[];
    preferred_lgas: string[];
  }) => api.post<{ success: boolean }>('/lenders/profile/step3', payload, true),

  getStatus: () => api.get<{ verified: boolean; current_step: number }>('/lenders/profile/status', true),
};

const normalizeLenderTier = (t: string): AnonymisedBorrower['tier'] => {
  const x = (t || 'Bronze').toLowerCase();
  if (x === 'silver') return 'Silver';
  if (x === 'gold') return 'Gold';
  if (x === 'platinum') return 'Platinum';
  return 'Bronze';
};

const mapLenderCustomer = (row: Record<string, unknown>): AnonymisedBorrower => ({
  id: String(row.id),
  display_name: String(row.display_name ?? 'Borrower'),
  pulse_score: Number(row.pulse_score ?? 0),
  tier: normalizeLenderTier(String(row.tier)),
  lga: String(row.location ?? ''),
  loan_amount_requested: Number(row.loan_amount_requested ?? 0),
  purpose: '',
  repayment_days: 30,
});

// ─── Lender ──────────────────────────────────────────────────
export const lenderAPI = {
  getStats: async (): Promise<LenderStats> => {
    const d = await v1OkData<{
      total_disbursed?: number;
      active_loans?: number;
      recovered?: number;
    }>('/lenders/stats', { method: 'GET' });
    const funded = (d.total_disbursed ?? 0) / 100;
    const recovered = (d.recovered ?? 0) / 100;
    const repayment_rate = funded > 0 ? Math.min(100, Math.round((recovered / funded) * 100)) : 0;
    return {
      total_funded: funded,
      active_loans: d.active_loans ?? 0,
      repayment_rate,
    };
  },

  getBorrowers: async (filters?: {
    minScore?: number;
    tier?: string;
    lga?: string;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    page?: number;
  }): Promise<AnonymisedBorrower[]> => {
    const params = new URLSearchParams();
    if (filters?.minScore != null) params.set('min_score', String(filters.minScore));
    if (filters?.tier && filters.tier !== 'All') params.set('tier', filters.tier);
    if (filters?.lga) params.set('lga', filters.lga);
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    const q = params.toString();
    const rows = await v1OkData<Record<string, unknown>[]>(
      `/lenders/customers${q ? `?${q}` : ''}`,
      { method: 'GET' }
    );
    let list = Array.isArray(rows) ? rows.map(mapLenderCustomer) : [];
    if (filters?.minAmount) list = list.filter(b => b.loan_amount_requested >= filters.minAmount!);
    if (filters?.maxAmount) list = list.filter(b => b.loan_amount_requested <= filters.maxAmount!);
    return list;
  },

  getBorrowerById: async (id: string): Promise<FullBorrowerProfile> => {
    const row = await v1OkData<Record<string, unknown>>(`/lenders/customers/${id}`, { method: 'GET' });
    const base = mapLenderCustomer(row);
    return {
      ...base,
      full_name: String(row.display_name ?? base.display_name),
      signals: (row.signals as FullBorrowerProfile['signals']) || {
        transaction_frequency: 0,
        transaction_growth: 0,
        gig_completion_rate: 0,
        repayment_history: 0,
        network_density: 0,
        financial_discipline: 0,
      },
      transaction_summary: (row.transaction_summary as FullBorrowerProfile['transaction_summary']) || {
        avg_monthly_volume: 0,
        transaction_days_per_month: 0,
        longest_streak: 0,
      },
    };
  },

  disburse: async (payload: {
    borrower_id: string;
    amount: number;
    repayment_days: number;
  }): Promise<{ success: boolean }> => {
    await v1OkData<{ success: boolean }>('/lenders/disburse', {
      method: 'POST',
      body: JSON.stringify({
        borrower_id: payload.borrower_id,
        amount: Math.round(payload.amount * 100),
        repayment_days: payload.repayment_days,
      }),
    });
    return { success: true };
  },

  getMyLoans: async (status?: 'active' | 'repaid' | 'overdue'): Promise<MyLoanRecord[]> => {
    const params = status && status !== ('all' as any) ? `?status=${status}` : '';
    const rows = await v1OkData<Record<string, unknown>[]>(`/lenders/loans${params}`, { method: 'GET' });
    const mapStatus = (s: string): MyLoanRecord['status'] => {
      const x = (s || '').toLowerCase();
      if (x.includes('repay') || x === 'completed') return 'repaid';
      if (x.includes('overdue') || x === 'defaulted') return 'overdue';
      return 'active';
    };
    return (Array.isArray(rows) ? rows : []).map((r) => ({
      borrower_name: String(r.borrower_name ?? ''),
      amount: Math.round(Number(r.amount ?? 0) / 100),
      disbursed_at: String(r.disbursed_at ?? ''),
      repayment_days: Number(r.repayment_days ?? 0),
      due_date: String(r.due_date ?? ''),
      amount_repaid: Math.round(Number(r.amount_repaid ?? 0) / 100),
      total_repayment: Math.round(Number(r.total_repayment ?? 0) / 100),
      status: mapStatus(String(r.status)),
      transaction_ref: String(r.transaction_ref ?? r.id ?? ''),
    }));
  },

  getLoanStats: async (): Promise<MyLoanStats> => {
    const d = await v1OkData<{
      total_disbursed?: number;
      active_loans?: number;
      recovered?: number;
    }>('/lenders/loans/stats', { method: 'GET' });
    return {
      total_disbursed: Math.round((d.total_disbursed ?? 0) / 100),
      active_loans: d.active_loans ?? 0,
      recovered: Math.round((d.recovered ?? 0) / 100),
    };
  },

  // Service offering APIs
  offerService: async (payload: {
    name: string;
    type: 'loan' | 'insurance' | 'savings';
    description: string;
    min_pulse_score: number;
    max_amount?: number;
    interest_rate?: number;
    premium_amount?: number;
    repayment_days?: number;
  }) => v1OkData<{ id: string }>('/lenders/services/offer', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      max_amount: payload.max_amount ? Math.round(payload.max_amount * 100) : undefined,
      premium_amount: payload.premium_amount ? Math.round(payload.premium_amount * 100) : undefined,
    }),
  }),

  getMyServices: async (type?: 'loan' | 'insurance' | 'savings' | 'overdue') => {
    const q = type ? `?type=${type}` : '';
    return v1OkData<any[]>(`/lenders/services${q}`, { method: 'GET' });
  },

  getServiceById: async (id: string) =>
    v1OkData<any>(`/lenders/services/${id}`, { method: 'GET' }),

  updateService: async (id: string, payload: Record<string, unknown>) =>
    v1OkData<any>(`/lenders/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

// ─── Partner ──────────────────────────────────────────────────
export const partnerAPI = {
  getMyProducts: async () => v1OkData<any[]>('/lenders/services', { method: 'GET' }),

  addProduct: async (payload: {
    name: string;
    type: 'loan' | 'insurance' | 'savings';
    description: string;
    min_pulse_score: number;
    max_amount?: number;
    interest_rate?: number;
    premium_amount?: number;
    repayment_days?: number;
  }) => lenderAPI.offerService(payload),

  enroll: async (payload: { customer_id: string; product_id: string }) =>
    v1OkData<{ success: boolean }>(`/lenders/services/${payload.product_id}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ customer_id: payload.customer_id }),
    }),

  getStats: async (): Promise<PartnerStats> => {
    const d = await v1OkData<{
      total_disbursed?: number;
      active_services?: number;
      customers_served?: number;
    }>('/lenders/stats', { method: 'GET' });
    return {
      total_disbursed: Math.round((d.total_disbursed ?? 0) / 100),
      active_services: d.active_services ?? 0,
      customers_served: d.customers_served ?? 0,
    };
  },

  getCustomers: async (filters?: {
    minScore?: number;
    tier?: string;
    lga?: string;
    minAmount?: number;
    maxAmount?: number;
    productType?: 'loan' | 'insurance' | 'savings';
    limit?: number;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.minScore != null) params.set('min_score', String(filters.minScore));
    if (filters?.tier && filters.tier !== 'All') params.set('tier', filters.tier);
    if (filters?.lga) params.set('lga', filters.lga);
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    const q = params.toString();
    const rows = await v1OkData<Record<string, unknown>[]>(
      `/lenders/customers${q ? `?${q}` : ''}`,
      { method: 'GET' }
    );
    return Array.isArray(rows) ? rows.map(mapLenderCustomer) : [];
  },

  getCustomerById: async (id: string) =>
    v1OkData<any>(`/lenders/customers/${id}`, { method: 'GET' }),

  disburse: async (payload: {
    customer_id: string;
    amount: number;
    repayment_days: number;
  }) => lenderAPI.disburse({
    borrower_id: payload.customer_id,
    amount: payload.amount,
    repayment_days: payload.repayment_days,
  }),

  getMyServices: async (type?: 'loan' | 'insurance' | 'savings' | 'overdue') =>
    lenderAPI.getMyServices(type),
};

export const jobSeekerOnboardingAPI = {
  skills: (payload: { skills: string[]; languages: string[]; primary_language: string }) =>
    api.post<{ success: boolean }>('/job-seekers/onboarding/skills', payload, true),

  experience: (payload: {
    years_of_experience: string;
    education_level: string;
    currently_employed: boolean;
    current_job_title?: string;
    current_employer?: string;
    work_history: {
      job_title: string;
      employer?: string;
      type: 'full_time' | 'part_time' | 'gig' | 'apprenticeship';
      duration: string;
    }[];
  }) =>
    api.post<{ success: boolean }>('/job-seekers/onboarding/experience', payload, true),

  cv: (formData: FormData) =>
    rawV1<{ success: boolean }>('/job-seekers/onboarding/cv', { method: 'POST', body: formData }),

  preferences: (payload: {
    availability: 'full_time' | 'part_time' | 'gig' | 'open';
    preferred_lgas: string[];
    willing_to_relocate: boolean;
    min_pay: number;
    pay_period: 'hour' | 'day' | 'week' | 'month' | 'gig';
    auto_save_pct: number;
    emergency_contact_name: string;
    emergency_contact_phone: string;
  }) =>
    api.post<{ success: boolean }>('/job-seekers/onboarding/preferences', payload, true),

  getStatus: () =>
    api.get<{ complete: boolean; current_step: 'skills' | 'experience' | 'cv' | 'preferences' | 'done' }>(
      '/job-seekers/onboarding/status',
      true,
    ),
};

// ─── Job Seeker Dashboard ───────────────────────────────────
export const jobSeekerAPI = {
  getDashboard: async () => {
    const d = await v1OkData<Record<string, unknown>>('/job-seekers/dashboard', { method: 'GET' });
    return {
      pulse_score: Number(d.pulse_score ?? 0),
      tier: String(d.tier ?? 'Bronze'),
      total_earned: Number(d.total_earned ?? 0),
      gigs_completed: Number(d.gigs_completed ?? d.applications ?? 0),
      squad_va_number: String(d.squad_va_number ?? ''),
      squad_va_balance: Number(d.squad_va_balance ?? 0),
    };
  },

  getRecommendedJobs: async (): Promise<JobMatch[]> => {
    const rows = await v1OkData<Record<string, unknown>[]>('/job-seekers/recommendations', { method: 'GET' });
    return Array.isArray(rows) ? rows.map(mapJobRow) : [];
  },

  getAllJobs: async (filters?: {
    search?: string;
    lga?: string;
    min_pay?: number;
    urgent?: boolean;
  }): Promise<JobMatch[]> => {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.lga) params.set('lga', filters.lga);
    if (filters?.min_pay != null) params.set('min_pay', String(filters.min_pay));
    if (filters?.urgent) params.set('urgent', 'true');
    const q = params.toString();
    const rows = await v1OkData<Record<string, unknown>[]>(
      `/job-seekers/jobs${q ? `?${q}` : ''}`,
      { method: 'GET' }
    );
    return Array.isArray(rows) ? rows.map(mapJobRow) : [];
  },

  applyForJob: async (jobId: string): Promise<{ success: boolean }> => {
    await v1OkData<unknown>(`/gigs/${jobId}/apply`, { method: 'POST', body: '{}' });
    return { success: true };
  },

  getTransactions: async (filter?: 'all' | 'inflow' | 'outflow'): Promise<JSTransaction[]> => {
    const { data } = await fetchTransactions(filter || 'all', 1, 40);
    return data.map((t) => ({
      id: t.id,
      type: t.type,
      counterparty: t.counterparty,
      amount: t.amount,
      timestamp: t.timestamp,
      reference: t.reference,
      description: t.description,
      purpose: t.purpose,
      senderName: t.senderName ?? null,
      receiverName: t.receiverName ?? null,
      feedLabel: t.feedLabel,
      status: t.status,
    }));
  },

  getPulseScore: async () => {
    const [d, signalsRes] = await Promise.all([
      v1OkData<Record<string, unknown>>('/job-seekers/dashboard', { method: 'GET' }),
      v1OkData<{ signals: PulseSignal[] }>('/credit/pulse-signals', { method: 'GET' }).catch(() => ({ signals: [] })),
    ]);
    return {
      score: Number(d.pulse_score ?? 0),
      tier: String(d.tier ?? 'Bronze'),
      signals: signalsRes?.signals ?? [],
    };
  },

  getPulseHistory: async () => {
    const data = await v1OkData<PulseHistoryPoint[]>('/credit/pulse-history', { method: 'GET' }).catch(() => []);
    return Array.isArray(data) ? data : [];
  },

  getGigHistory: async (status?: 'completed' | 'cancelled'): Promise<GigRecord[]> => {
    const q = status ? `?status=${status}` : '';
    const apps = await v1OkData<Record<string, unknown>[]>(`/job-seekers/applications${q}`, { method: 'GET' });
    return (Array.isArray(apps) ? apps : []).map((a) => ({
      id: String(a.gig_id ?? a.id),
      title: String(a.gig_title || 'Gig'),
      employer: String(a.employer || ''),
      date: String(a.applied_at || a.completed_at || ''),
      pay: Math.round(Number(a.pay ?? 0) / 100),
      duration: String(a.duration || ''),
      status: (String(a.status).toLowerCase().includes('cancel') ? 'cancelled' : 'completed') as GigRecord['status'],
      rating: a.rating == null ? null : Number(a.rating),
      review: a.review == null ? null : String(a.review),
    }));
  },

  getNotifications: async (type?: 'job' | 'payment' | 'score'): Promise<JSNotification[]> => {
    const q = type ? `?type=${type}` : '';
    const rows = await v1OkData<Record<string, unknown>[]>(`/job-seekers/notifications${q}`, { method: 'GET' }).catch(() => []);
    return (Array.isArray(rows) ? rows : []).map((n) => ({
      id: String(n.id),
      type: (String(n.type || 'job') as JSNotification['type']),
      title: String(n.title || ''),
      body: String(n.body || ''),
      created_at: String(n.created_at || ''),
      read: Boolean(n.read),
    }));
  },

  markNotificationsRead: async (): Promise<{ success: boolean }> => {
    await v1OkData<unknown>('/job-seekers/mark-notifications-read', { method: 'POST', body: '{}' }).catch(() => null);
    return { success: true };
  },

  getQRCode: async () => {
    const d = await v1OkData<Record<string, unknown>>('/job-seekers/qr', { method: 'GET' }).catch(() => null);
    if (!d) return { customer_identifier: '', zovu_id: '', name: '', skills: [] as string[] };
    return {
      customer_identifier: String(d.customer_identifier || ''),
      zovu_id: String(d.zovu_id || ''),
      name: String(d.name || ''),
      skills: Array.isArray(d.skills) ? (d.skills as string[]) : [],
    };
  },
};

// ─── Ajo ────────────────────────────────────────────────────
export const ajoAPI = {
  listGroups: async (): Promise<AjoGroup[]> => {
    const rows = await v1OkData<Record<string, unknown>[]>('/ajo/groups', { method: 'GET' }).catch(() => []);
    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: r.description ? String(r.description) : null,
      minimum_deposit: Math.round(Number(r.minimum_deposit ?? r.contribution_amount ?? 0) / 100),
      end_date: r.end_date ? String(r.end_date) : null,
      total_balance: Math.round(Number(r.total_balance ?? 0) / 100),
      member_count: Number(r.member_count ?? 0),
      status: String(r.status || 'active'),
      joined: Boolean(r.joined),
      total_contributed: r.total_contributed != null ? Math.round(Number(r.total_contributed) / 100) : undefined,
      estimated_return: r.estimated_return != null ? Math.round(Number(r.estimated_return) / 100) : undefined,
      merchant_squad_account: r.merchant_squad_account ? String(r.merchant_squad_account) : null,
    }));
  },

  joinGroup: async (ajoId: string): Promise<{ success: boolean }> => {
    await v1OkData<unknown>(`/ajo/${ajoId}/join`, { method: 'POST', body: '{}' });
    return { success: true };
  },

  contribute: async (ajoId: string, amountNaira: number): Promise<{ success: boolean; squad_account?: string }> => {
    const res = await v1OkData<{ squad_account?: string }>(`/ajo/${ajoId}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount: Math.round(amountNaira * 100) }),
    });
    return { success: true, squad_account: res?.squad_account };
  },

  getTransactions: async (): Promise<AjoTransaction[]> => {
    const rows = await v1OkData<Record<string, unknown>[]>('/ajo/transactions', { method: 'GET' }).catch(() => []);
    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: String(r.id),
      ajo_id: String(r.ajo_id),
      ajo_name: String(r.ajo_name || ''),
      amount: Math.round(Number(r.amount ?? 0) / 100),
      type: (r.type === 'payout' ? 'payout' : 'contribution') as AjoTransaction['type'],
      status: String(r.status || 'completed'),
      timestamp: String(r.timestamp || r.created_at || ''),
    }));
  },

  // Admin-only
  admin: {
    createGroup: async (payload: {
      name: string;
      description?: string;
      minimum_deposit: number;
      end_date: string;
    }) => v1OkData<{ id: string }>('/admin/ajo/groups', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        minimum_deposit: Math.round(payload.minimum_deposit * 100),
      }),
    }),

    listGroups: async () => v1OkData<any[]>('/admin/ajo/groups', { method: 'GET' }),

    listTransactions: async () =>
      v1OkData<any[]>('/admin/ajo/transactions', { method: 'GET' }),
  },
};

export { ApiError };
