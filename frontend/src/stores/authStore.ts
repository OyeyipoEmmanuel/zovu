import { create } from 'zustand';

interface AuthState {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: 'Trader' | 'Job Seeker' | 'Lender' | 'Both';
    businessName: string;
    profileCompletion: number;
    kycComplete: boolean;
    squadVaNumber: string | null;
    squadVaBank: string | null;
  } | null;
  token: string | null;
  updateUser: (updates: Partial<NonNullable<AuthState['user']>>) => void;
  setUser: (user: AuthState['user']) => void;
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
    localStorage.removeItem('zovu_refresh_token');
    set({ user: null, token: null });
  },
}));
