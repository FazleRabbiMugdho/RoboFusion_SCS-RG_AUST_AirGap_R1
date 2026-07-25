import { create } from "zustand";

interface UIState {
  isSidebarExpanded: boolean;
  isMuted: boolean;
  toggleSidebar: () => void;
  toggleMute: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarExpanded: true,
  isMuted: false,
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
}));
