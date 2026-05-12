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
  { month: 'Nov', score: 40 },
  { month: 'Dec', score: 210 },
  { month: 'Jan', score: 380 },
  { month: 'Feb', score: 500 },
  { month: 'Mar', score: 600 },
  { month: 'Apr', score: 687 },
];

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
