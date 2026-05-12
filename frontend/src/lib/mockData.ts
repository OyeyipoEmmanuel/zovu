export interface Transaction {
  id: string;
  type: 'inflow' | 'outflow';
  counterparty: string;
  amount: number;
  timestamp: string;
  reference: string;
  description: string;
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
  urgency: 'Normal' | 'Urgent';
  skills: string[];
  languages: string[];
  postedAt: string;
  status: 'active' | 'closed';
}

export interface VirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  balance: number;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  role: 'Trader' | 'Job Seeker';
  businessName: string;
  profileCompletion: number;
  avatarUrl: string | null;
  kycComplete: boolean;
  squadVaNumber: string | null;
  squadVaBank: string | null;
}

export const mockUser: UserProfile = {
  firstName: 'Mama',
  lastName: 'Tunde',
  email: 'mama.tunde@zovu.ng',
  role: 'Trader',
  businessName: 'Mama Tunde Provisions',
  profileCompletion: 60,
  avatarUrl: null,
  kycComplete: false,
  squadVaNumber: null,
  squadVaBank: null,
};

export const mockVirtualAccount: VirtualAccount = {
  accountNumber: '0123456789',
  accountName: 'MAMA TUNDE / ZOVU',
  bankName: 'Squad by GT Bank',
  balance: 284500,
};

export const mockTransactions: Transaction[] = [
  {
    id: 'txn_001',
    type: 'inflow',
    counterparty: 'Alhaji Musa Garba',
    amount: 45000,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    reference: 'ZVU-7A3F9B2E',
    description: 'Payment for 3 bags of rice',
  },
  {
    id: 'txn_002',
    type: 'outflow',
    counterparty: 'Dangote Cement Dealer',
    amount: 18500,
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    reference: 'ZVU-4C8D1E5A',
    description: 'Cement supply payment',
  },
  {
    id: 'txn_003',
    type: 'inflow',
    counterparty: 'Mrs. Adebayo Comfort',
    amount: 12000,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-9F2B7C3D',
    description: 'Provision supplies',
  },
  {
    id: 'txn_004',
    type: 'inflow',
    counterparty: 'Chinedu Okafor',
    amount: 67500,
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-1D4E8A6F',
    description: 'Bulk order — cooking oil',
  },
  {
    id: 'txn_005',
    type: 'outflow',
    counterparty: 'Lagos Market Association',
    amount: 5000,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-3B7F2D9C',
    description: 'Monthly market dues',
  },
  {
    id: 'txn_006',
    type: 'inflow',
    counterparty: 'Fatima Bello',
    amount: 22000,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-6E1A4B8D',
    description: 'Grocery order',
  },
  {
    id: 'txn_007',
    type: 'outflow',
    counterparty: 'MTN Airtime',
    amount: 3000,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-8C5D3F7A',
    description: 'Airtime purchase',
  },
  {
    id: 'txn_008',
    type: 'inflow',
    counterparty: 'Emeka Nwankwo',
    amount: 38000,
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-2A9E6C1B',
    description: 'Wholesale purchase',
  },
];

export const mockPulseScore = {
  score: 687,
  maxScore: 850,
  tier: 'Gold' as const,
  loanEligibility: 500000,
};

export const mockPulseSignals: PulseSignal[] = [
  { label: 'Transaction Frequency', value: 78 },
  { label: 'Transaction Growth', value: 65 },
  { label: 'Gig Completion Rate', value: 70 },
  { label: 'Repayment History', value: 55 },
  { label: 'Network Density', value: 60 },
  { label: 'Financial Discipline', value: 72 },
];

export const mockPulseHistory: PulseHistoryPoint[] = [
  { month: 'Jan', score: 320 },
  { month: 'Feb', score: 380 },
  { month: 'Mar', score: 450 },
  { month: 'Apr', score: 590 },
  { month: 'May', score: 687 },
];

export const mockLenderStats = {
  total_funded: 4200000,
  active_loans: 12,
  repayment_rate: 94
};

export const mockBorrowers = [
  {
    id: "b001",
    display_name: "Trader •••",
    pulse_score: 687,
    tier: "Gold",
    lga: "Surulere",
    loan_amount_requested: 200000,
    purpose: "Restocking",
    repayment_days: 60
  },
  {
    id: "b002",
    display_name: "Trader •••",
    pulse_score: 542,
    tier: "Silver",
    lga: "Ikeja",
    loan_amount_requested: 150000,
    purpose: "Equipment",
    repayment_days: 30
  },
  {
    id: "b003",
    display_name: "Seeker •••",
    pulse_score: 478,
    tier: "Bronze",
    lga: "Oshodi",
    loan_amount_requested: 80000,
    purpose: "Emergency",
    repayment_days: 30
  },
  {
    id: "b004",
    display_name: "Trader •••",
    pulse_score: 761,
    tier: "Platinum",
    lga: "Lagos Island",
    loan_amount_requested: 500000,
    purpose: "Restocking",
    repayment_days: 90
  }
];

export const mockFullBorrower = {
  id: "b001",
  display_name: "Trader •••",
  full_name: "Oluwatunde Ajayi",
  pulse_score: 687,
  tier: "Gold",
  lga: "Surulere",
  loan_amount_requested: 200000,
  purpose: "Restocking",
  repayment_days: 60,
  signals: {
    transaction_frequency: 78,
    transaction_growth: 65,
    gig_completion_rate: 70,
    repayment_history: 55,
    network_density: 60,
    financial_discipline: 72
  },
  transaction_summary: {
    avg_monthly_volume: 284500,
    transaction_days_per_month: 22,
    longest_streak: 14
  }
};

export const mockLenderProfile = {
  organization_name: "Eko Cooperative Society",
  account_type: "cooperative",
  phone: "08012345678",
  verified: false,
  current_step: 1
};

export const mockLenderProfileStatus = {
  verified: true,
  current_step: 'complete'
};

export const mockGigs: Gig[] = [
  {
    id: 'gig_001',
    title: 'Shop Assistant Needed',
    description: 'Looking for a reliable shop assistant to help manage my provisions store at Balogun Market. Must be honest, hardworking, and good with customers.',
    pay: 3500,
    payPeriod: 'Per Day',
    location: 'Lagos Island',
    urgency: 'Normal',
    skills: ['Customer Service', 'Inventory', 'Cash Handling'],
    languages: ['Yoruba', 'English'],
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'gig_002',
    title: 'Delivery Rider — Mainland',
    description: 'Need an okada rider to deliver goods from Balogun to Surulere and Yaba. Must have own bike and know Lagos roads well.',
    pay: 5000,
    payPeriod: 'Per Day',
    location: 'Surulere',
    urgency: 'Urgent',
    skills: ['Riding', 'Navigation', 'Time Management'],
    languages: ['Pidgin', 'Yoruba'],
    postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'gig_003',
    title: 'Weekend Inventory Help',
    description: 'Need someone to help count and organize stock every Saturday morning. About 4 hours of work.',
    pay: 2500,
    payPeriod: 'Per Day',
    location: 'Lagos Island',
    urgency: 'Normal',
    skills: ['Organization', 'Counting', 'Attention to Detail'],
    languages: ['English', 'Yoruba'],
    postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
];

export const mockRecentPayments = [
  {
    id: 'pay_001',
    sender: 'Alhaji Musa Garba',
    amount: 45000,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay_002',
    sender: 'Mrs. Adebayo Comfort',
    amount: 12000,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay_003',
    sender: 'Chinedu Okafor',
    amount: 67500,
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay_004',
    sender: 'Fatima Bello',
    amount: 22000,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay_005',
    sender: 'Emeka Nwankwo',
    amount: 38000,
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const LAGOS_LGAS = [
  'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa',
  'Badagry', 'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye',
  'Ikeja', 'Ikorodu', 'Kosofe', 'Lagos Island', 'Lagos Mainland',
  'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere',
];

export const mockMyLoans = [
  {
    borrower_name: "Oluwatunde Ajayi",
    amount: 200000,
    disbursed_at: "2026-04-12",
    repayment_days: 60,
    due_date: "2026-06-11",
    amount_repaid: 103000,
    total_repayment: 206000,
    status: "active",
    transaction_ref: "REF20260412S67978035"
  },
  {
    borrower_name: "Chidinma Okafor",
    amount: 150000,
    disbursed_at: "2026-03-01",
    repayment_days: 30,
    due_date: "2026-03-31",
    amount_repaid: 154500,
    total_repayment: 154500,
    status: "repaid",
    transaction_ref: "REF20260301S45123091"
  },
  {
    borrower_name: "Musa Abdullahi",
    amount: 80000,
    disbursed_at: "2026-03-15",
    repayment_days: 30,
    due_date: "2026-04-14",
    amount_repaid: 20000,
    total_repayment: 82400,
    status: "overdue",
    transaction_ref: "REF20260315S12098234"
  },
  {
    borrower_name: "Folake Adeyemi",
    amount: 500000,
    disbursed_at: "2026-04-20",
    repayment_days: 90,
    due_date: "2026-07-19",
    amount_repaid: 0,
    total_repayment: 515000,
    status: "active",
    transaction_ref: "REF20260420S99012345"
  }
];
