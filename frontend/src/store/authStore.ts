import { create } from "zustand";

export type UserRole = "STAFF" | "ADMIN";

interface AuthState {
  token: string | null;
  role: UserRole | null;
  username: string | null;
  login: (token: string, role: UserRole, username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  username: null,
  login: (token, role, username) => set({ token, role, username }),
  logout: () => set({ token: null, role: null, username: null }),
}));
