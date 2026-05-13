import { create } from 'zustand'
import type { AnonymisedBorrower, FullBorrowerProfile, LoanRecord, LenderStats } from '../types/lender'

export interface PartnerProduct {
  id: string
  name: string
  type: 'loan' | 'insurance' | 'savings'
  description: string
  min_pulse_score: number
  max_amount?: number
  interest_rate?: number
  premium_amount?: number
  repayment_days?: number
  active_enrollments: number
}

interface PartnerStore {
  stats: LenderStats | null
  borrowers: AnonymisedBorrower[]
  selectedBorrower: FullBorrowerProfile | null
  loans: LoanRecord[]
  filters: {
    minScore?: number
    tier?: string
    lga?: string
    minAmount?: number
    maxAmount?: number
    productType?: 'loan' | 'insurance' | 'savings'
  }
  disbursing: boolean
  disburseSuccess: boolean
  setFilters: (filters: Partial<PartnerStore['filters']>) => void
  setSelectedBorrower: (borrower: FullBorrowerProfile | null) => void
  setDisbursing: (val: boolean) => void
  setDisburseSuccess: (val: boolean) => void
  setStats: (stats: LenderStats) => void
  setBorrowers: (borrowers: AnonymisedBorrower[]) => void

  lenderVerified: boolean
  currentProfileStep: 1 | 2 | 3 | 'complete'
  accountType: 'individual' | 'microfinance' | 'cooperative' | 'fintech' | null
  organizationName: string | null

  setLenderVerified: (val: boolean) => void
  setCurrentProfileStep: (step: 1 | 2 | 3 | 'complete') => void
  setAccountType: (type: string) => void
  setOrganizationName: (name: string) => void

  partnerType: 'microfinance' | 'insurance' | 'cooperative' | 'fintech' | 'individual' | null
  products: PartnerProduct[]
  setPartnerType: (type: string) => void
  setProducts: (products: PartnerProduct[]) => void
}

export const usePartnerStore = create<PartnerStore>((set) => ({
  stats: null,
  borrowers: [],
  selectedBorrower: null,
  loans: [],
  filters: {},
  disbursing: false,
  disburseSuccess: false,
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  setSelectedBorrower: (borrower) => set({ selectedBorrower: borrower }),
  setDisbursing: (val) => set({ disbursing: val }),
  setDisburseSuccess: (val) => set({ disburseSuccess: val }),
  setStats: (stats) => set({ stats }),
  setBorrowers: (borrowers) => set({ borrowers }),

  lenderVerified: false,
  currentProfileStep: 1,
  accountType: null,
  organizationName: null,

  setLenderVerified: (val) => set({ lenderVerified: val }),
  setCurrentProfileStep: (step) => set({ currentProfileStep: step }),
  setAccountType: (type) => set({ accountType: type as any }),
  setOrganizationName: (name) => set({ organizationName: name }),

  partnerType: null,
  products: [],
  setPartnerType: (type) => set({ partnerType: type as any }),
  setProducts: (products) => set({ products }),
}))
