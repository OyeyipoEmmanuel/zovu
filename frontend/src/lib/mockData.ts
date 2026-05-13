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
  role: 'trader' | 'job_seeker' | 'partner';
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
  role: 'trader',
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

export const mockJobSeekerOnboardingStatus = {
  complete: false,
  current_step: 'skills'
};

export const mockJobSeekerProfile = {
  skills: ['Logistics', 'Heavy Lifting', 'Driving'],
  languages: ['Yoruba', 'Pidgin', 'English'],
  primary_language: 'Pidgin',
  years_of_experience: '1-3 years',
  education_level: 'Senior Secondary (WAEC/NECO)',
  currently_employed: false,
  work_history: [
    {
      job_title: 'Loader',
      employer: 'Mile 12 Market',
      type: 'gig',
      duration: '2 years'
    }
  ],
  availability: 'open',
  preferred_lgas: ['Mile 12', 'Oshodi', 'Surulere'],
  willing_to_relocate: false,
  min_pay: 5000,
  pay_period: 'day',
  auto_save_pct: 10,
  emergency_contact_name: 'Mama Tobi',
  emergency_contact_phone: '08098765432'
};

export const mockPartnerProducts = [
  {
    id: "p001",
    name: "SME Restock Loan",
    type: "loan",
    description: "Short term loans for traders to restock inventory",
    min_pulse_score: 400,
    max_amount: 500000,
    interest_rate: 3,
    repayment_days: 60,
    active_enrollments: 8
  },
  {
    id: "p002",
    name: "Zovu Shield Silver",
    type: "insurance",
    description: "Asset protection for market traders",
    min_pulse_score: 300,
    premium_amount: 800,
    active_enrollments: 24
  },
  {
    id: "p003",
    name: "Emergency Cash",
    type: "loan",
    description: "Quick 30-day emergency loans",
    min_pulse_score: 350,
    max_amount: 150000,
    interest_rate: 4,
    repayment_days: 30,
    active_enrollments: 6
  }
];

export const mockPartnerStats = {
  total_disbursed: 4200000,
  active_services: 12,
  customers_served: 38
};

export const mockInsuranceServices = [
  {
    id: "s001",
    type: "insurance",
    customer_name: "Chidinma Okafor",
    product_name: "Zovu Shield Silver",
    monthly_premium: 800,
    coverage_amount: 200000,
    next_deduction: "2026-06-01",
    status: "active"
  }
];

// ─── Job Seeker Dashboard Mock Data ────────────────────────

export interface JobMatch {
  id: string;
  title: string;
  employer: string;
  pay: number;
  pay_period: string;
  lga: string;
  match_pct: number;
  match_reasons: string[];
  skills_required: string[];
  posted: string;
  urgent: boolean;
  applied: boolean;
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
}

export interface JSNotification {
  id: string;
  type: 'job' | 'payment' | 'score';
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export const mockJobSeekerDashboard = {
  pulse_score: 312,
  tier: 'Bronze',
  total_earned: 47500,
  gigs_completed: 9,
  squad_va_number: '9013151600',
  squad_va_balance: 12400,
};

export const mockRecommendedJobs: JobMatch[] = [
  {
    id: 'j001',
    title: 'Loader / Offloader',
    employer: 'Mama Tunde Ajayi',
    pay: 5000,
    pay_period: 'day',
    lga: 'Mile 12',
    match_pct: 94,
    match_reasons: ['Skill match', 'Near you', 'Urgent'],
    skills_required: ['Logistics', 'Heavy Lifting'],
    posted: '2 hours ago',
    urgent: true,
    applied: false,
  },
  {
    id: 'j002',
    title: 'Delivery Driver',
    employer: 'Folake Adeyemi',
    pay: 8000,
    pay_period: 'day',
    lga: 'Surulere',
    match_pct: 87,
    match_reasons: ['Skill match', 'Good rating'],
    skills_required: ['Driving', 'Logistics'],
    posted: '5 hours ago',
    urgent: false,
    applied: false,
  },
  {
    id: 'j003',
    title: 'Market Sales Assistant',
    employer: 'Alhaji Musa Stores',
    pay: 3500,
    pay_period: 'day',
    lga: 'Oshodi',
    match_pct: 78,
    match_reasons: ['Near you', 'Language match'],
    skills_required: ['Sales', 'Customer Service'],
    posted: 'Yesterday',
    urgent: false,
    applied: false,
  },
];

export const mockAllJobs: JobMatch[] = [
  ...mockRecommendedJobs,
  {
    id: 'j004',
    title: 'Warehouse Organizer',
    employer: 'Dangote Logistics',
    pay: 6000,
    pay_period: 'day',
    lga: 'Ikeja',
    match_pct: 65,
    match_reasons: ['Skill match'],
    skills_required: ['Organization', 'Heavy Lifting', 'Inventory'],
    posted: '1 day ago',
    urgent: false,
    applied: false,
  },
  {
    id: 'j005',
    title: 'Construction Helper',
    employer: 'BuildRight Nigeria',
    pay: 7000,
    pay_period: 'day',
    lga: 'Lekki',
    match_pct: 52,
    match_reasons: [],
    skills_required: ['Construction', 'Heavy Lifting'],
    posted: '2 days ago',
    urgent: true,
    applied: false,
  },
  {
    id: 'j006',
    title: 'Night Security Guard',
    employer: 'Balogun Plaza',
    pay: 4000,
    pay_period: 'day',
    lga: 'Lagos Island',
    match_pct: 40,
    match_reasons: [],
    skills_required: ['Security', 'Alertness'],
    posted: '3 days ago',
    urgent: false,
    applied: false,
  },
];

export const mockJobSeekerGigHistory: GigRecord[] = [
  {
    id: 'g001',
    title: 'Loader / Offloader',
    employer: 'Mama Tunde Ajayi',
    date: '2026-05-10',
    pay: 5000,
    duration: '1 day',
    status: 'completed',
    rating: 5,
    review: 'Reliable and hardworking. Will hire again.',
  },
  {
    id: 'g002',
    title: 'Delivery Driver',
    employer: 'Chidi Okeke',
    date: '2026-05-07',
    pay: 8000,
    duration: '2 days',
    status: 'completed',
    rating: 4,
    review: 'Good driver, arrived on time.',
  },
  {
    id: 'g003',
    title: 'Security Guard',
    employer: 'Balogun Plaza',
    date: '2026-04-30',
    pay: 0,
    duration: '1 day',
    status: 'cancelled',
    rating: null,
    review: null,
  },
  {
    id: 'g004',
    title: 'Warehouse Sorter',
    employer: 'Dangote Logistics',
    date: '2026-04-25',
    pay: 6000,
    duration: '1 day',
    status: 'completed',
    rating: 5,
    review: 'Excellent worker. Very efficient.',
  },
  {
    id: 'g005',
    title: 'Market Porter',
    employer: 'Alhaji Musa Stores',
    date: '2026-04-20',
    pay: 3500,
    duration: '1 day',
    status: 'completed',
    rating: 4,
    review: null,
  },
  {
    id: 'g006',
    title: 'Delivery Driver',
    employer: 'Folake Adeyemi',
    date: '2026-04-15',
    pay: 8000,
    duration: '2 days',
    status: 'completed',
    rating: 5,
    review: 'On time and professional.',
  },
  {
    id: 'g007',
    title: 'Loader / Offloader',
    employer: 'Chidi Okeke',
    date: '2026-04-10',
    pay: 5000,
    duration: '1 day',
    status: 'completed',
    rating: 3,
    review: null,
  },
  {
    id: 'g008',
    title: 'Shop Assistant',
    employer: 'Fatima Bello',
    date: '2026-04-05',
    pay: 3500,
    duration: '1 day',
    status: 'completed',
    rating: 4,
    review: 'Helpful and polite.',
  },
  {
    id: 'g009',
    title: 'Market Porter',
    employer: 'Emeka Nwankwo',
    date: '2026-03-28',
    pay: 3500,
    duration: '1 day',
    status: 'completed',
    rating: 5,
    review: 'Punctual and strong. Would recommend.',
  },
];

export const mockJobSeekerTransactions: JSTransaction[] = [
  {
    id: 'jst_001',
    type: 'inflow',
    counterparty: 'Mama Tunde Ajayi',
    amount: 5000,
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-JS-7A3F9B',
    description: 'Gig payment — Loader / Offloader',
  },
  {
    id: 'jst_002',
    type: 'inflow',
    counterparty: 'Chidi Okeke',
    amount: 8000,
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-JS-4C8D1E',
    description: 'Gig payment — Delivery Driver',
  },
  {
    id: 'jst_003',
    type: 'outflow',
    counterparty: 'MTN Airtime',
    amount: 500,
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-JS-9F2B7C',
    description: 'Airtime top-up',
  },
  {
    id: 'jst_004',
    type: 'inflow',
    counterparty: 'Dangote Logistics',
    amount: 6000,
    timestamp: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-JS-1D4E8A',
    description: 'Gig payment — Warehouse Sorter',
  },
  {
    id: 'jst_005',
    type: 'inflow',
    counterparty: 'Alhaji Musa Stores',
    amount: 3500,
    timestamp: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-JS-3B7F2D',
    description: 'Gig payment — Market Porter',
  },
  {
    id: 'jst_006',
    type: 'inflow',
    counterparty: 'Folake Adeyemi',
    amount: 8000,
    timestamp: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-JS-6E1A4B',
    description: 'Gig payment — Delivery Driver',
  },
  {
    id: 'jst_007',
    type: 'outflow',
    counterparty: 'Zovu Auto-Save',
    amount: 1400,
    timestamp: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'ZVU-JS-8C5D3F',
    description: 'Auto-save deduction (10%)',
  },
];

export const mockJobSeekerPulseSignals = [
  { label: 'Transaction Frequency', value: 35 },
  { label: 'Transaction Growth', value: 28 },
  { label: 'Gig Completion Rate', value: 72 },
  { label: 'Punctuality Index', value: 80 },
  { label: 'Repayment History', value: 0 },
  { label: 'Financial Discipline', value: 45 },
];

export const mockJobSeekerPulseHistory = [
  { month: 'Nov', score: 0 },
  { month: 'Dec', score: 40 },
  { month: 'Jan', score: 120 },
  { month: 'Feb', score: 210 },
  { month: 'Mar', score: 280 },
  { month: 'Apr', score: 312 },
];

export const mockJobSeekerNotifications: JSNotification[] = [
  {
    id: 'n001',
    type: 'job',
    title: 'New match: Loader needed at Mile 12',
    body: 'Mama Tunde needs a Loader. ₦5,000. Rainy Day premium included. 94% match.',
    time: '2 mins ago',
    unread: true,
  },
  {
    id: 'n002',
    type: 'payment',
    title: 'Payment received',
    body: '₦5,000 from Mama Tunde Ajayi has been credited to your Zovu account.',
    time: '1 hour ago',
    unread: true,
  },
  {
    id: 'n003',
    type: 'score',
    title: 'Your Pulse Score increased',
    body: 'Great work! Your Pulse Score went up by 12 points to 312 after completing your last gig.',
    time: '1 hour ago',
    unread: false,
  },
  {
    id: 'n004',
    type: 'job',
    title: 'New match: Delivery Driver needed in Surulere',
    body: 'Folake Adeyemi needs a driver for 2 days. ₦8,000. Skill match.',
    time: 'Yesterday',
    unread: false,
  },
  {
    id: 'n005',
    type: 'payment',
    title: 'Loan application update',
    body: 'You need a Pulse Score of 400 to apply for a loan. You are 88 points away.',
    time: '2 days ago',
    unread: false,
  },
];

export const mockJobSeekerQR = {
  customer_identifier: 'SQD_CUST_TOBI_ADEBAYO_00391',
  zovu_id: 'ZOVU_JS_00391',
  name: 'Tobi Adebayo',
  skills: ['Logistics', 'Heavy Lifting', 'Driving'],
};
