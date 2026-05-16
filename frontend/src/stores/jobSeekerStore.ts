import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JobMatch, GigRecord, JSTransaction, JSNotification } from '../lib/mockData'

export interface WorkHistoryItem {
  job_title: string
  employer?: string
  type: 'full_time' | 'part_time' | 'gig' | 'apprenticeship'
  duration: string
}

interface JobSeekerStore {
  // Onboarding
  jobSeekerOnboardingComplete: boolean
  currentOnboardingStep: 'skills' | 'experience' | 'cv' | 'preferences' | 'complete'
  skills: string[]
  languages: string[]
  primaryLanguage: string | null
  yearsExperience: string | null
  educationLevel: string | null
  currentlyEmployed: boolean
  workHistory: WorkHistoryItem[]
  availability: string | null
  preferredLgas: string[]
  willingToRelocate: boolean
  minPay: number | null
  payPeriod: string | null
  autoSavePct: number

  // KYC & VA
  kycComplete: boolean
  squadVaCreated: boolean

  // Dashboard
  pulseScore: number | null
  pulseHistory: number[]
  transactions: JSTransaction[]
  recommendedJobs: JobMatch[]
  allJobs: JobMatch[]
  gigHistory: GigRecord[]
  notifications: JSNotification[]
  squadVaNumber: string | null
  squadVaBalance: number | null
  appliedJobs: string[]
  redirectReason: string | null

  // Onboarding actions
  setOnboardingComplete: (val: boolean) => void
  setCurrentStep: (step: JobSeekerStore['currentOnboardingStep']) => void
  setSkills: (skills: string[]) => void
  setLanguages: (languages: string[]) => void
  setPrimaryLanguage: (lang: string) => void

  // KYC & VA actions
  setKycComplete: (val: boolean) => void
  setSquadVaCreated: (val: boolean) => void

  // Dashboard actions
  setPulseScore: (score: number) => void
  setPulseHistory: (history: number[]) => void
  setTransactions: (txns: JSTransaction[]) => void
  setRecommendedJobs: (jobs: JobMatch[]) => void
  setAllJobs: (jobs: JobMatch[]) => void
  setGigHistory: (gigs: GigRecord[]) => void
  setNotifications: (notifs: JSNotification[]) => void
  setSquadVaNumber: (num: string) => void
  setSquadVaBalance: (bal: number) => void
  addAppliedJob: (jobId: string) => void
  setRedirectReason: (reason: string | null) => void
}

export const useJobSeekerStore = create<JobSeekerStore>()(
  persist(
    (set) => ({
  // Onboarding
  jobSeekerOnboardingComplete: false,
  currentOnboardingStep: 'skills',
  skills: [],
  languages: [],
  primaryLanguage: null,
  yearsExperience: null,
  educationLevel: null,
  currentlyEmployed: false,
  workHistory: [],
  availability: null,
  preferredLgas: [],
  willingToRelocate: false,
  minPay: null,
  payPeriod: null,
  autoSavePct: 10,

  // KYC & VA
  kycComplete: false,
  squadVaCreated: false,

  // Dashboard
  pulseScore: null,
  pulseHistory: [],
  transactions: [],
  recommendedJobs: [],
  allJobs: [],
  gigHistory: [],
  notifications: [],
  squadVaNumber: null,
  squadVaBalance: null,
  appliedJobs: [],
  redirectReason: null,

  // Onboarding actions
  setOnboardingComplete: (val) => set({ jobSeekerOnboardingComplete: val }),
  setCurrentStep: (step) => set({ currentOnboardingStep: step }),
  setSkills: (skills) => set({ skills }),
  setLanguages: (languages) => set({ languages }),
  setPrimaryLanguage: (lang) => set({ primaryLanguage: lang }),

  // KYC & VA actions
  setKycComplete: (val) => set({ kycComplete: val }),
  setSquadVaCreated: (val) => set({ squadVaCreated: val }),

  // Dashboard actions
  setPulseScore: (score) => set({ pulseScore: score }),
  setPulseHistory: (history) => set({ pulseHistory: history }),
  setTransactions: (txns) => set({ transactions: txns }),
  setRecommendedJobs: (jobs) => set({ recommendedJobs: jobs }),
  setAllJobs: (jobs) => set({ allJobs: jobs }),
  setGigHistory: (gigs) => set({ gigHistory: gigs }),
  setNotifications: (notifs) => set({ notifications: notifs }),
  setSquadVaNumber: (num) => set({ squadVaNumber: num }),
  setSquadVaBalance: (bal) => set({ squadVaBalance: bal }),
  addAppliedJob: (jobId) => set((state) => ({
    appliedJobs: state.appliedJobs.includes(jobId)
      ? state.appliedJobs
      : [...state.appliedJobs, jobId],
  })),
  setRedirectReason: (reason) => set({ redirectReason: reason }),
}),
    {
      name: 'job-seeker-store',
      partialize: (state) => ({ appliedJobs: state.appliedJobs }),
    },
  ),
)

// ─── Feature Access Hook ─────────────────────────────────────

export const useJobSeekerFeatureAccess = () => {
  const {
    jobSeekerOnboardingComplete,
    kycComplete,
    squadVaCreated,
  } = useJobSeekerStore()

  return {
    canApplyForJobs: jobSeekerOnboardingComplete,
    canViewTransactions: squadVaCreated,
    canReceivePayments: squadVaCreated,
    canApplyForLoans: kycComplete && squadVaCreated,
    canApplyForInsurance: kycComplete,
    canViewPulseScore: jobSeekerOnboardingComplete,
    canViewGigHistory: jobSeekerOnboardingComplete,
  }
}
