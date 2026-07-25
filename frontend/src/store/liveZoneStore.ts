import { create } from "zustand";
import type { ZoneStateUpdateMessage } from "../types/ws-messages";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

interface LiveZoneState {
  zoneStates: Record<string, ZoneStateUpdateMessage>;
  connectionStatus: ConnectionStatus;
  applyZoneUpdate: (msg: ZoneStateUpdateMessage) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useLiveZoneStore = create<LiveZoneState>((set) => ({
  zoneStates: {},
  connectionStatus: "offline",
  applyZoneUpdate: (msg) =>
    set((state) => ({
      zoneStates: {
        ...state.zoneStates,
        [String(msg.zone_id)]: msg,
      },
    })),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
