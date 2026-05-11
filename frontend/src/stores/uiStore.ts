import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  loading: Record<string, boolean>;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (key: string, value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  activeTab: 'all',
  loading: {},

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setLoading: (key, value) =>
    set((s) => ({ loading: { ...s.loading, [key]: value } })),
}));
