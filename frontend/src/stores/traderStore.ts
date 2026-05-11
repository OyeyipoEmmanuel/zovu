import { create } from 'zustand';
import type { Transaction, PulseSignal, PulseHistoryPoint, Gig } from '../lib/mockData';

interface TraderState {
  balance: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  pulseScore: number;
  pulseTier: string;
  loanEligibility: number;
  pulseSignals: PulseSignal[];
  pulseHistory: PulseHistoryPoint[];
  transactions: Transaction[];
  gigs: Gig[];

  setBalance: (balance: number) => void;
  setAccount: (data: { accountNumber: string; accountName: string; bankName: string; balance: number }) => void;
  setPulse: (data: { score: number; tier: string; loanEligibility: number; signals: PulseSignal[] }) => void;
  setPulseHistory: (history: PulseHistoryPoint[]) => void;
  setTransactions: (txns: Transaction[]) => void;
  setGigs: (gigs: Gig[]) => void;
  addGig: (gig: Gig) => void;
}

export const useTraderStore = create<TraderState>((set) => ({
  balance: 0,
  accountNumber: '',
  accountName: '',
  bankName: '',
  pulseScore: 0,
  pulseTier: '',
  loanEligibility: 0,
  pulseSignals: [],
  pulseHistory: [],
  transactions: [],
  gigs: [],

  setBalance: (balance) => set({ balance }),
  setAccount: ({ accountNumber, accountName, bankName, balance }) =>
    set({ accountNumber, accountName, bankName, balance }),
  setPulse: ({ score, tier, loanEligibility, signals }) =>
    set({ pulseScore: score, pulseTier: tier, loanEligibility, pulseSignals: signals }),
  setPulseHistory: (pulseHistory) => set({ pulseHistory }),
  setTransactions: (transactions) => set({ transactions }),
  setGigs: (gigs) => set({ gigs }),
  addGig: (gig) => set((s) => ({ gigs: [gig, ...s.gigs] })),
}));
