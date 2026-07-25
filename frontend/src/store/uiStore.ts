import { create } from "zustand";

export interface ToastItem {
  id: string;
  zoneId: string;
  zoneName: string;
  timestamp: number;
}

interface UIState {
  isSidebarExpanded: boolean;
  isMuted: boolean;
  toasts: ToastItem[];
  toggleSidebar: () => void;
  toggleMute: () => void;
  addToast: (toast: { zoneId: string; zoneName: string; timestamp: number }) => void;
  dismissToast: (id: string) => void;
  dismissToastForZone: (zoneId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarExpanded: true,
  isMuted: false,
  toasts: [],
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  addToast: ({ zoneId, zoneName, timestamp }) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${zoneId}-${Date.now()}-${Math.random()}`,
          zoneId,
          zoneName,
          timestamp,
        },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  dismissToastForZone: (zoneId) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => String(t.zoneId) !== String(zoneId)),
    })),
}));
