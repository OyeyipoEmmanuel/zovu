export interface AnonymisedBorrower {
  id: string
  display_name: string
  pulse_score: number
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  lga: string
  loan_amount_requested: number
  purpose: string
  repayment_days: number
}

export interface FullBorrowerProfile extends AnonymisedBorrower {
  full_name: string
  signals: {
    transaction_frequency: number
    transaction_growth: number
    gig_completion_rate: number
    repayment_history: number
    network_density: number
    financial_discipline: number
  }
  transaction_summary: {
    avg_monthly_volume: number
    transaction_days_per_month: number
    longest_streak: number
  }
}

export interface LoanRecord {
  id: string
  borrower_name: string
  amount: number
  repayment_days: number
  disbursed_at: string
  status: 'active' | 'repaid' | 'overdue'
  transaction_ref: string
}

export interface LenderStats {
  total_funded: number
  active_loans: number
  repayment_rate: number
}
