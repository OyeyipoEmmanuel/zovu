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
  type Transaction,
  type PulseSignal,
  type PulseHistoryPoint,
  type Gig,
  type VirtualAccount,
  type UserProfile,
} from './mockData';
import type { LenderStats, AnonymisedBorrower, FullBorrowerProfile } from '../types/lender';

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

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

const BASE_URL = '/api';

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

const request = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> => {
  const { auth = true, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (auth) Object.assign(headers, getAuthHeader());

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new ApiError(res.status, data.detail ?? 'Request failed');
  return data as T;
};

const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// ─── User ──────────────────────────────────────────────────
export const fetchUserProfile = async (): Promise<UserProfile> => {
  if (USE_MOCK) {
    await delay(400);
    return mockUser;
  }
  return request<UserProfile>('/user/me');
};

// ─── Virtual Account ───────────────────────────────────────
export const fetchVirtualAccount = async (): Promise<VirtualAccount> => {
  if (USE_MOCK) {
    await delay(300);
    return mockVirtualAccount;
  }
  return request<VirtualAccount>('/payments/virtual-account');
};

// ─── Transactions ──────────────────────────────────────────
export const fetchTransactions = async (
  filter: 'all' | 'inflow' | 'outflow' = 'all',
  page = 1,
  limit = 20
): Promise<{ data: Transaction[]; total: number }> => {
  if (USE_MOCK) {
    await delay(500);
    const filtered =
      filter === 'all'
        ? mockTransactions
        : mockTransactions.filter((t) => t.type === filter);
    return { data: filtered, total: filtered.length };
  }
  return request<{ data: Transaction[]; total: number }>(
    `/transactions?filter=${filter}&page=${page}&limit=${limit}`
  );
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
    await delay(400);
    return { ...mockPulseScore, signals: mockPulseSignals };
  }
  return request('/pulse/score');
};

export const fetchPulseHistory = async (): Promise<PulseHistoryPoint[]> => {
  if (USE_MOCK) {
    await delay(300);
    return mockPulseHistory;
  }
  return request<PulseHistoryPoint[]>('/pulse/history');
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
  return request<Gig>('/gigs/post', { method: 'POST', body: JSON.stringify(gig) });
};

export const fetchMyGigs = async (): Promise<Gig[]> => {
  if (USE_MOCK) {
    await delay(400);
    return mockGigs;
  }
  return request<Gig[]>('/gigs/my-gigs');
};

// ─── Payments ──────────────────────────────────────────────
export const fetchRecentPayments = async (): Promise<
  { id: string; sender: string; amount: number; timestamp: string }[]
> => {
  if (USE_MOCK) {
    await delay(300);
    return mockRecentPayments;
  }
  return request('/payments/recent');
};



// ─── KYC & Profile ───────────────────────────────────────────
export const submitKYC = async (data: any): Promise<{ kyc_complete: boolean; squad_va_number: string; squad_va_bank: string }> => {
  if (USE_MOCK) {
    await delay(1500);
    mockUser.kycComplete = true;
    mockUser.squadVaNumber = '0123456789';
    mockUser.squadVaBank = 'GTBank';
    return { kyc_complete: true, squad_va_number: '0123456789', squad_va_bank: 'GTBank' };
  }
  return request('/user/kyc', { method: 'POST', body: JSON.stringify(data) });
};

export const submitBusinessInfo = async (data: any): Promise<{ success: boolean }> => {
  if (USE_MOCK) {
    await delay(1000);
    mockUser.profileCompletion = 100;
    return { success: true };
  }
  return request('/user/business-info', { method: 'POST', body: JSON.stringify(data) });
};

export const fetchKYCStatus = async (): Promise<{ kyc_complete: boolean; squad_va_number: string | null }> => {
  if (USE_MOCK) {
    await delay(300);
    return { kyc_complete: false, squad_va_number: null };
  }
  return request('/user/kyc-status');
};

// ─── Loans ─────────────────────────────────────────────────
export const applyForLoan = async (data: { amount: number; purpose: string; repayment_period: string }): Promise<{ success: boolean }> => {
  if (USE_MOCK) {
    await delay(2000);
    return { success: true };
  }
  return request('/loans/apply', { method: 'POST', body: JSON.stringify(data) });
};

export const fetchMyApplications = async (): Promise<any[]> => {
  if (USE_MOCK) {
    await delay(500);
    return [];
  }
  return request('/loans/my-applications');
};

export const lenderProfileAPI = {
  step1: (payload: {
    organization_name: string
    account_type: 'individual' | 'microfinance' | 'cooperative' | 'fintech'
    phone: string
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    return request('/api/lender/profile/step1', { method: 'POST', body: JSON.stringify(payload) });
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
    return request('/api/lender/profile/step2', { method: 'POST', body: JSON.stringify(payload) });
  },

  step2Organization: (payload: {
    cac_number: string
    organization_bvn: string
    year_established: number
  }) => {
    if (USE_MOCK) {
      return delay(1000).then(() => ({ success: true }));
    }
    return request('/api/lender/profile/step2', { method: 'POST', body: JSON.stringify(payload) });
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
    return request('/api/lender/profile/step3', { method: 'POST', body: JSON.stringify(payload) });
  },

  getStatus: () => {
    if (USE_MOCK) {
      return delay(500).then(() => ({ verified: false, current_step: 1 }));
    }
    return request<{ verified: boolean, current_step: 1 | 2 | 3 | 'complete' }>('/api/lender/profile/status');
  }
};

// ─── Lender ──────────────────────────────────────────────────
export const lenderAPI = {
  getStats: async (): Promise<LenderStats> => {
    if (USE_MOCK) {
      await delay(500);
      return mockLenderStats;
    }
    return request<LenderStats>('/api/lender/stats');
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
    const params = filters ? new URLSearchParams(filters as any).toString() : '';
    return request<AnonymisedBorrower[]>(`/api/lender/borrowers${params ? '?' + params : ''}`);
  },

  getBorrowerById: async (id: string): Promise<FullBorrowerProfile> => {
    if (USE_MOCK) {
      await delay(500);
      return mockFullBorrower as FullBorrowerProfile;
    }
    return request<FullBorrowerProfile>(`/api/lender/borrowers/${id}`);
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
    return request<{ success: boolean }>('/api/lender/disburse', { method: 'POST', body: JSON.stringify(payload) });
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
    return request<MyLoanRecord[]>(`/api/lender/loans${params}`);
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
    return request<MyLoanStats>('/api/lender/loans/stats');
  },
};

export { ApiError };
