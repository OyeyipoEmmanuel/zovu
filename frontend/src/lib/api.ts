import {
  mockUser,
  mockVirtualAccount,
  mockTransactions,
  mockPulseScore,
  mockPulseSignals,
  mockPulseHistory,
  mockGigs,
  mockRecentPayments,
  type Transaction,
  type PulseSignal,
  type PulseHistoryPoint,
  type Gig,
  type VirtualAccount,
  type UserProfile,
} from './mockData';

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

export { ApiError };
