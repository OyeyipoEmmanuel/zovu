import { create } from 'zustand';

export type UserRole = 'trader' | 'job_seeker' | 'lender';

export interface AuthUser {
  email: string;
  role: UserRole;
  id?: string;
  display_name?: string;
  email_verified?: boolean;
  profile_complete?: boolean;
  squad_account_number?: string | null;
  squad_account_bank?: string | null;
  squad_provisioned?: boolean;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  profileCompletion?: number;
  kycComplete?: boolean;
  squadVaNumber?: string | null;
  squadVaBank?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  updateUser: (updates: Partial<AuthUser>) => void;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('zovu_access_token'),
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('zovu_access_token', token);
    } else {
      localStorage.removeItem('zovu_access_token');
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('zovu_access_token');
    set({ user: null, token: null });
  },
}));
