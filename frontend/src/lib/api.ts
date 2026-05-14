import {
  mockUser,
  mockVirtualAccount,
  mockTransactions,
  mockPulseScore,
  mockPulseSignals,
  mockPulseHistory,
  mockGigs,
  mockRecentPayments,
  mockLenderStats,
  mockBorrowers,
  mockFullBorrower,
  mockMyLoans,
  mockPartnerProducts,
  mockPartnerStats,
  mockInsuranceServices,
  mockJobSeekerDashboard,
  mockRecommendedJobs,
  mockAllJobs,
  mockJobSeekerGigHistory,
  mockJobSeekerTransactions,
  mockJobSeekerPulseSignals,
  mockJobSeekerPulseHistory,
  mockJobSeekerNotifications,
  mockJobSeekerQR,
  type Transaction,
  type PulseSignal,
  type PulseHistoryPoint,
  type Gig,
  type VirtualAccount,
  type UserProfile,
  type JobMatch,
  type GigRecord,
  type JSTransaction,
  type JSNotification,
} from './mockData';
import type { LenderStats, AnonymisedBorrower, FullBorrowerProfile } from '../types/lender';
import { api } from '../services/api';

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

/** Use mock fixtures only when VITE_USE_MOCK === 'true'. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const API_V1 = '/api/v1';

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

const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Legacy JSON fetch for non-envelope /api/v1 routes (credit, loans, transactions). */
const rawV1 = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> => {
  const { auth = true, ...init } = options;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  if (auth) Object.assign(headers, getAuthHeader());
  const res = await fetch(`${API_V1}${path}`, { ...init, headers, credentials: 'include' });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = data.detail as string | { msg?: string }[] | undefined;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? String(detail[0]?.msg ?? detail)
          : (data.message as string) ?? 'Request failed';
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
  return {
    id: me.id,
    firstName: me.first_name?.trim() || '',
    lastName: me.last_name?.trim() || '',
    email: me.email,
    role: (me.role === 'job_seeker' ? 'job_seeker' : me.role === 'partner' ? 'partner' : 'trader') as UserProfile['role'],
    businessName: (me.business_name || '').trim(),
    profileCompletion: completion,
    avatarUrl: null,
    kycComplete: kycDone,
    squadVaNumber: me.squad_account_number ?? null,
    squadVaBank: me.squad_account_bank ?? null,
  };
};

const mapTxnRow = (row: TxnListItem): Transaction => ({
  id: row.id,
  type: row.direction === 'inflow' ? 'inflow' : 'outflow',
  counterparty: row.feed_label || String(row.transaction_type || 'Transaction').replace(/_/g, ' '),
  amount: Math.round((row.amount ?? 0) / 100),
  timestamp: row.created_at,
  reference: row.squad_reference || row.id,
  description: String(row.transaction_type || '').replace(/_/g, ' '),
});

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
  };
};

const mapJobRow = (row: Record<string, unknown>): JobMatch => ({
  id: String(row.id),
  title: String(row.title || ''),
  employer: String(row.employer || ''),
  pay: Math.round(Number(row.pay ?? 0) / 100),
  pay_period: String(row.pay_period || 'gig'),
  lga: String(row.lga || row.location || ''),
  match_pct: Number(row.match_pct ?? 0),
  match_reasons: Array.isArray(row.match_reasons) ? (row.match_reasons as string[]) : [],
  skills_required: Array.isArray(row.skills_required) ? (row.skills_required as string[]) : [],
  posted: String(row.created_at || row.posted || new Date().toISOString()),
  urgent: Boolean(row.urgent),
  applied: Boolean(row.applied),
});

// ─── User ──────────────────────────────────────────────────
export const fetchUserProfile = async (): Promise<UserProfile> => {
  if (USE_MOCK) {
    await delay(400);
    return mockUser;
  }
  const me = await getAuthMeCached();
  return mapMeToUserProfile(me);
};

// ─── Virtual Account ───────────────────────────────────────
export const fetchVirtualAccount = async (): Promise<VirtualAccount> => {
  if (USE_MOCK) {
    await delay(300);
    return mockVirtualAccount;
  }
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
  if (USE_MOCK) {
    await delay(import.meta.env.DEV ? 0 : 120);
    const filtered =
      filter === 'all'
        ? mockTransactions
        : mockTransactions.filter((t) => t.type === filter);
    return { data: filtered, total: filtered.length };
  }
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
  if (USE_MOCK) {
    await delay(import.meta.env.DEV ? 0 : 200);
    return { ...mockPulseScore, signals: mockPulseSignals };
  }
  const [me, credit] = await Promise.all([
    getAuthMeCached(),
    rawV1<CreditStatusResponse>('/credit/status', { method: 'GET' }),
  ]);
  const score = me.pulse_score ?? 0;
  return {
    score,
    maxScore: 850,
    tier: getPulseTier(score),
    loanEligibility: Math.round((credit.max_eligible_loan ?? 0) / 100),
    signals: [],
  };
};

export const fetchPulseHistory = async (): Promise<PulseHistoryPoint[]> => {
  if (USE_MOCK) {
    await delay(300);
    return mockPulseHistory;
  }
  return [];
};

// ─── Gigs ──────────────────────────────────────────────────
export const postGig = async (
  gig: Omit<Gig, 'id' | 'postedAt' | 'status'>
): Promise<Gig> => {
  if (USE_MOCK) {
    await delay(800);
    return {
      ...gig,
      id: `gig_${Date.now()}`,
      postedAt: new Date().toISOString(),
      status: 'active',
    };
  }
  const body = {
    title: gig.title,
    description: gig.description,
    skill_required: gig.skills.length ? gig.skills.join(', ') : 'General',
    location: gig.location,
    amount: Math.max(1, Math.round(gig.pay * 100)),
    payment_period: gig.payPeriod,
  };
  const created = await v1OkData<Record<string, unknown>>('/gigs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapBackendGigToGig(created);
};

export const fetchMyGigs = async (): Promise<Gig[]> => {
  if (USE_MOCK) {
    await delay(import.meta.env.DEV ? 0 : 200);
    return mockGigs;
  }
  const list = await v1OkData<Record<string, unknown>[]>('/gigs/my-gigs', { method: 'GET' });
  return Array.isArray(list) ? list.map(mapBackendGigToGig) : [];
};

// ─── Payments ──────────────────────────────────────────────
export const fetchRecentPayments = async (): Promise<
  { id: string; sender: string; amount: number; timestamp: string }[]
> => {
  if (USE_MOCK) {
    await delay(300);
    return mockRecentPayments;
  }
  const { data } = await fetchTransactions('inflow', 1, 8);
  return data.map((t) => ({
    id: t.id,
    sender: t.counterparty,
    amount: t.amount,
    timestamp: t.timestamp,
  }));
};

// ─── KYC & Profile ───────────────────────────────────────────
export const submitKYC = async (
  data: Record<string, unknown>
): Promise<{ kyc_complete: boolean; squad_va_number: string; squad_va_bank: string }> => {
  if (USE_MOCK) {
    await delay(1500);
    mockUser.kycComplete = true;
    mockUser.squadVaNumber = '0123456789';
    mockUser.squadVaBank = 'GTBank';
    return { kyc_complete: true, squad_va_number: '0123456789', squad_va_bank: 'GTBank' };
  }
  const dobRaw = typeof data.dob === 'string' ? data.dob : '';
  let date_of_birth = dobRaw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
    date_of_birth = `${dobRaw}T00:00:00Z`;
  } else if (dobRaw.includes('/')) {
    const [m, d, y] = dobRaw.split('/');
    if (y && m && d) date_of_birth = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`;
  }
  const first = (data.first_name as string) || (data.middle_name as string) || 'User';
  const last = (data.last_name as string) || 'Trader';
  await api.post<{ status: string; message: string }>(
    '/auth/kyc',
    {
      first_name: first,
      last_name: last,
      date_of_birth,
      phone: (data.phone as string) || '+2348000000001',
      bvn: data.bvn as string | undefined,
      nin: data.nin as string | undefined,
    },
    true
  );
  invalidateAuthMeCache();
  const me = await getAuthMeCached();
  return {
    kyc_complete: Boolean(me.kyc_verified),
    squad_va_number: me.squad_account_number || '',
    squad_va_bank: me.squad_account_bank || '',
  };
};

export const submitBusinessInfo = async (_data: unknown): Promise<{ success: boolean }> => {
  if (USE_MOCK) {
    await delay(1000);
    mockUser.profileCompletion = 100;
    return { success: true };
  }
  return { success: true };
};

export const fetchKYCStatus = async (): Promise<{ kyc_complete: boolean; squad_va_number: string | null }> => {
  if (USE_MOCK) {
    await delay(300);
    return { kyc_complete: false, squad_va_number: null };
  }
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
  if (USE_MOCK) {
    await delay(2000);
    return { success: true };
  }
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
  if (USE_MOCK) {
    await delay(500);
    return [];
  }
  const res = await rawV1<{ loans: unknown[] }>('/loans');
  return res.loans ?? [];
};

export const lenderProfileAPI = {
  step1: (payload: {
    organization_name: string
    account_type: 'individual' | 'microfinance' | 'cooperative' | 'fintech' | 'insurance'
    phone: string
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void payload;
    return Promise.resolve({ success: true });
  },

  step2Individual: (payload: {
    bvn: string
    nin: string
    dob: string
    gender: '1' | '2'
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void payload;
    return Promise.resolve({ success: true });
  },

  step2Organization: (payload: {
    cac_number: string
    organization_bvn: string
    year_established: number
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void payload;
    return Promise.resolve({ success: true });
  },

  step3: (payload: {
    bank_name: string
    account_number: string
    account_name: string
    min_lending_amount: number
    max_lending_amount: number
    preferred_tiers: string[]
    preferred_lgas: string[]
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void payload;
    return Promise.resolve({ success: true });
  },

  getStatus: () => {
    if (USE_MOCK) {
      return delay(500).then(() => ({ verified: false, current_step: 1 }));
    }
    return Promise.resolve({ verified: false, current_step: 1 as const });
  }
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
    if (USE_MOCK) {
      await delay(500);
      return mockLenderStats;
    }
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
    minScore?: number
    tier?: string
    lga?: string
    minAmount?: number
    maxAmount?: number
    limit?: number
    page?: number
  }): Promise<AnonymisedBorrower[]> => {
    if (USE_MOCK) {
      await delay(500);
      let res = [...mockBorrowers];
      if (filters?.minScore) res = res.filter(b => b.pulse_score >= filters.minScore!);
      if (filters?.tier && filters.tier !== 'All') res = res.filter(b => b.tier === filters.tier);
      if (filters?.lga) res = res.filter(b => b.lga === filters.lga);
      if (filters?.minAmount) res = res.filter(b => b.loan_amount_requested >= filters.minAmount!);
      if (filters?.maxAmount) res = res.filter(b => b.loan_amount_requested <= filters.maxAmount!);
      if (filters?.limit) res = res.slice(0, filters.limit);
      return res as AnonymisedBorrower[];
    }
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
    if (USE_MOCK) {
      await delay(500);
      return mockFullBorrower as FullBorrowerProfile;
    }
    const row = await v1OkData<Record<string, unknown>>(`/lenders/customers/${id}`, { method: 'GET' });
    const base = mapLenderCustomer(row);
    return {
      ...base,
      full_name: String(row.display_name ?? base.display_name),
      signals: {
        transaction_frequency: 0,
        transaction_growth: 0,
        gig_completion_rate: 0,
        repayment_history: 0,
        network_density: 0,
        financial_discipline: 0,
      },
      transaction_summary: {
        avg_monthly_volume: 0,
        transaction_days_per_month: 0,
        longest_streak: 0,
      },
    };
  },

  disburse: async (payload: {
    borrower_id: string
    amount: number
    repayment_days: number
  }): Promise<{ success: boolean }> => {
    if (USE_MOCK) {
      await delay(1500);
      return { success: true };
    }
    void payload;
    return { success: false };
  },

  getMyLoans: async (status?: 'active' | 'repaid' | 'overdue'): Promise<MyLoanRecord[]> => {
    if (USE_MOCK) {
      await delay(600);
      let loans = [...mockMyLoans] as MyLoanRecord[];
      if (status && status !== 'all' as any) {
        loans = loans.filter(l => l.status === status);
      }
      return loans;
    }
    const params = status && status !== 'all' as any ? `?status=${status}` : '';
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
    if (USE_MOCK) {
      await delay(400);
      return {
        total_disbursed: 4200000,
        active_loans: 12,
        recovered: 1850000,
      };
    }
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
};

// ─── Partner (no v1 API yet — live builds return empty / noop) ─────
export const partnerAPI = {
  getMyProducts: async () => {
    if (USE_MOCK) {
      await delay(500);
      return mockPartnerProducts;
    }
    return [];
  },

  addProduct: async (payload: {
    name: string
    type: 'loan' | 'insurance' | 'savings'
    description: string
    min_pulse_score: number
    max_amount?: number
    interest_rate?: number
    premium_amount?: number
    repayment_days?: number
  }) => {
    if (USE_MOCK) {
      await delay(1000);
      return { success: true };
    }
    void payload;
    return { success: false };
  },

  enroll: async (payload: {
    customer_id: string
    product_id: string
  }) => {
    if (USE_MOCK) {
      await delay(1500);
      return { success: true };
    }
    void payload;
    return { success: false };
  },

  getStats: async (): Promise<PartnerStats> => {
    if (USE_MOCK) {
      await delay(500);
      return mockPartnerStats;
    }
    return { total_disbursed: 0, active_services: 0, customers_served: 0 };
  },

  getCustomers: async (filters?: {
    minScore?: number
    tier?: string
    lga?: string
    minAmount?: number
    maxAmount?: number
    productType?: 'loan' | 'insurance' | 'savings'
    limit?: number
    page?: number
  }) => {
    if (USE_MOCK) {
      await delay(500);
      let res = [...mockBorrowers];
      if (filters?.minScore) res = res.filter(b => b.pulse_score >= filters.minScore!);
      if (filters?.tier && filters.tier !== 'All') res = res.filter(b => b.tier === filters.tier);
      if (filters?.lga) res = res.filter(b => b.lga === filters.lga);
      if (filters?.minAmount) res = res.filter(b => b.loan_amount_requested >= filters.minAmount!);
      if (filters?.maxAmount) res = res.filter(b => b.loan_amount_requested <= filters.maxAmount!);
      if (filters?.limit) res = res.slice(0, filters.limit);
      return res;
    }
    return [];
  },

  getCustomerById: async (id: string) => {
    if (USE_MOCK) {
      await delay(500);
      return mockFullBorrower;
    }
    void id;
    return null;
  },

  disburse: async (payload: {
    customer_id: string
    amount: number
    repayment_days: number
  }) => {
    if (USE_MOCK) {
      await delay(1500);
      return { success: true };
    }
    void payload;
    return { success: false };
  },

  getMyServices: async (type?: 'loan' | 'insurance' | 'savings' | 'overdue') => {
    if (USE_MOCK) {
      await delay(600);
      const loanServices = (mockMyLoans as any[]).map(l => ({ ...l, type: 'loan' }));
      const insuranceServices = (mockInsuranceServices as any[]);
      let all = [...loanServices, ...insuranceServices];
      if (type === 'loan') all = all.filter(s => s.type === 'loan');
      else if (type === 'insurance') all = all.filter(s => s.type === 'insurance');
      else if (type === 'savings') all = all.filter(s => s.type === 'savings');
      else if (type === 'overdue') all = all.filter(s => s.status === 'overdue');
      return all;
    }
    return [];
  },
};

export const jobSeekerOnboardingAPI = {
  skills: (payload: {
    skills: string[]
    languages: string[]
    primary_language: string
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void payload;
    return Promise.resolve({ success: true });
  },

  experience: (payload: {
    years_of_experience: string
    education_level: string
    currently_employed: boolean
    current_job_title?: string
    current_employer?: string
    work_history: {
      job_title: string
      employer?: string
      type: 'full_time' | 'part_time' | 'gig' | 'apprenticeship'
      duration: string
    }[]
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void payload;
    return Promise.resolve({ success: true });
  },

  cv: (formData: FormData) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void formData;
    return Promise.resolve({ success: true });
  },

  preferences: (payload: {
    availability: 'full_time' | 'part_time' | 'gig' | 'open'
    preferred_lgas: string[]
    willing_to_relocate: boolean
    min_pay: number
    pay_period: 'hour' | 'day' | 'week' | 'month' | 'gig'
    auto_save_pct: number
    emergency_contact_name: string
    emergency_contact_phone: string
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    void payload;
    return Promise.resolve({ success: true });
  },

  getStatus: () => {
    if (USE_MOCK) {
      return delay(500).then(() => ({ complete: false, current_step: 'skills' as const }));
    }
    return Promise.resolve({ complete: false, current_step: 'skills' as const });
  }
};

// ─── Job Seeker Dashboard ───────────────────────────────────
export const jobSeekerAPI = {
  getDashboard: async () => {
    if (USE_MOCK) {
      await delay(500);
      return mockJobSeekerDashboard;
    }
    const d = await v1OkData<Record<string, unknown>>('/job-seekers/dashboard', { method: 'GET' });
    return {
      pulse_score: Number(d.pulse_score ?? 0),
      tier: String(d.tier ?? 'Bronze'),
      total_earned: 0,
      gigs_completed: Number(d.applications ?? 0),
      squad_va_number: '',
      squad_va_balance: 0,
    };
  },

  getRecommendedJobs: async (): Promise<JobMatch[]> => {
    if (USE_MOCK) {
      await delay(500);
      return mockRecommendedJobs;
    }
    const rows = await v1OkData<Record<string, unknown>[]>('/job-seekers/recommendations', { method: 'GET' });
    return Array.isArray(rows) ? rows.map(mapJobRow) : [];
  },

  getAllJobs: async (filters?: {
    search?: string;
    lga?: string;
    min_pay?: number;
    urgent?: boolean;
  }): Promise<JobMatch[]> => {
    if (USE_MOCK) {
      await delay(500);
      let jobs = [...mockAllJobs];
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        jobs = jobs.filter(j => j.title.toLowerCase().includes(q) || j.skills_required.some(s => s.toLowerCase().includes(q)));
      }
      if (filters?.lga) jobs = jobs.filter(j => j.lga === filters.lga);
      if (filters?.min_pay) jobs = jobs.filter(j => j.pay >= filters.min_pay!);
      if (filters?.urgent) jobs = jobs.filter(j => j.urgent);
      return jobs;
    }
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
    if (USE_MOCK) {
      await delay(800);
      return { success: true };
    }
    await v1OkData<unknown>(`/gigs/${jobId}/apply`, { method: 'POST', body: '{}' });
    return { success: true };
  },

  getTransactions: async (filter?: 'all' | 'inflow' | 'outflow'): Promise<JSTransaction[]> => {
    if (USE_MOCK) {
      await delay(500);
      if (!filter || filter === 'all') return mockJobSeekerTransactions;
      return mockJobSeekerTransactions.filter(t => t.type === filter);
    }
    const { data } = await fetchTransactions(filter || 'all', 1, 40);
    return data.map((t) => ({
      id: t.id,
      type: t.type,
      counterparty: t.counterparty,
      amount: t.amount,
      timestamp: t.timestamp,
      reference: t.reference,
      description: t.description,
    }));
  },

  getPulseScore: async () => {
    if (USE_MOCK) {
      await delay(400);
      return {
        score: mockJobSeekerDashboard.pulse_score,
        tier: mockJobSeekerDashboard.tier,
        signals: mockJobSeekerPulseSignals,
      };
    }
    const d = await v1OkData<Record<string, unknown>>('/job-seekers/dashboard', { method: 'GET' });
    return {
      score: Number(d.pulse_score ?? 0),
      tier: String(d.tier ?? 'Bronze'),
      signals: [],
    };
  },

  getPulseHistory: async () => {
    if (USE_MOCK) {
      await delay(300);
      return mockJobSeekerPulseHistory;
    }
    return [];
  },

  getGigHistory: async (status?: 'completed' | 'cancelled'): Promise<GigRecord[]> => {
    if (USE_MOCK) {
      await delay(500);
      if (!status) return mockJobSeekerGigHistory;
      return mockJobSeekerGigHistory.filter(g => g.status === status);
    }
    const apps = await v1OkData<Record<string, unknown>[]>('/job-seekers/applications', { method: 'GET' });
    return (Array.isArray(apps) ? apps : []).map((a) => ({
      id: String(a.gig_id ?? a.id),
      title: 'Gig',
      employer: '',
      date: String(a.applied_at || ''),
      pay: 0,
      duration: '',
      status: (String(a.status).toLowerCase().includes('cancel') ? 'cancelled' : 'completed') as GigRecord['status'],
      rating: null,
      review: null,
    }));
  },

  getNotifications: async (type?: 'job' | 'payment' | 'score'): Promise<JSNotification[]> => {
    if (USE_MOCK) {
      await delay(400);
      if (!type) return mockJobSeekerNotifications;
      return mockJobSeekerNotifications.filter(n => n.type === type);
    }
    void type;
    return [];
  },

  markNotificationsRead: async (): Promise<{ success: boolean }> => {
    if (USE_MOCK) {
      await delay(300);
      return { success: true };
    }
    return { success: true };
  },

  getQRCode: async () => {
    if (USE_MOCK) {
      await delay(300);
      return mockJobSeekerQR;
    }
    return {
      customer_identifier: '',
      zovu_id: '',
      name: '',
      skills: [] as string[],
    };
  },
};

export { ApiError };
