import { z } from 'zod';

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Employed (Full-time)' },
  { value: 'part_time', label: 'Employed (Part-time)' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'freelancer', label: 'Freelancer / Gig Worker' },
  { value: 'student', label: 'Student' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'retired', label: 'Retired' },
] as const;

export const INCOME_RANGE_OPTIONS = [
  { value: 'below_50k', label: 'Below ₦50,000' },
  { value: '50k_100k', label: '₦50,000 – ₦100,000' },
  { value: '100k_250k', label: '₦100,000 – ₦250,000' },
  { value: '250k_500k', label: '₦250,000 – ₦500,000' },
  { value: '500k_1m', label: '₦500,000 – ₦1,000,000' },
  { value: 'above_1m', label: 'Above ₦1,000,000' },
] as const;

export const FINANCIAL_GOAL_OPTIONS = [
  { value: 'savings', label: 'Build Savings' },
  { value: 'credit', label: 'Access Credit / Loans' },
  { value: 'insurance', label: 'Get Insurance' },
  { value: 'investments', label: 'Start Investing' },
  { value: 'business_funding', label: 'Fund My Business' },
  { value: 'financial_tracking', label: 'Track My Finances' },
] as const;

export const financialProfileSchema = z.object({
  employmentStatus: z
    .string()
    .min(1, 'Employment status is required'),

  occupation: z
    .string()
    .min(2, 'Occupation must be at least 2 characters')
    .max(100, 'Occupation must be at most 100 characters'),

  monthlyIncome: z
    .string()
    .min(1, 'Monthly income range is required'),

  bankName: z
    .string()
    .min(2, 'Bank name is required')
    .max(100, 'Bank name must be at most 100 characters'),

  accountNumber: z
    .string()
    .regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),

  financialGoal: z
    .string()
    .min(1, 'Please select a financial goal'),

  hasExistingLoans: z
    .string()
    .min(1, 'Please indicate your loan status'),

  agreedToTerms: z
    .literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms of Service and Privacy Policy' }),
    }),
});

export type FinancialProfileFormData = z.infer<typeof financialProfileSchema>;

export const LOAN_STATUS_OPTIONS = [
  { value: 'none', label: 'No existing loans' },
  { value: 'one', label: '1 active loan' },
  { value: 'multiple', label: '2 or more active loans' },
] as const;

export const NIGERIAN_BANKS = [
  'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank',
  'First Bank of Nigeria', 'First City Monument Bank (FCMB)', 'Globus Bank',
  'Guaranty Trust Bank (GTBank)', 'Heritage Bank', 'Jaiz Bank', 'Keystone Bank',
  'Kuda Bank', 'Opay', 'Palmpay', 'Polaris Bank', 'Providus Bank',
  'Stanbic IBTC Bank', 'Standard Chartered', 'Sterling Bank', 'SunTrust Bank',
  'Titan Trust Bank', 'Union Bank', 'United Bank for Africa (UBA)',
  'Unity Bank', 'VFD Microfinance Bank', 'Wema Bank', 'Zenith Bank',
].map((b) => ({ value: b.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: b }));
