import { create } from 'zustand'
import type { AnonymisedBorrower, FullBorrowerProfile, LoanRecord, LenderStats } from '../types/lender'

interface LenderStore {
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
  }
  disbursing: boolean
  disburseSuccess: boolean
  setFilters: (filters: Partial<LenderStore['filters']>) => void
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
}

export const useLenderStore = create<LenderStore>((set) => ({
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
}))
