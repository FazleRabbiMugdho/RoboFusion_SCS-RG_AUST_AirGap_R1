import { create } from "zustand";
import type { ZoneStateUpdateMessage } from "../types/ws-messages";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface CriticalTransitionEvent {
  eventId: number;
  zoneId: string;
  zoneName: string;
  timestamp: number;
}

interface LiveZoneState {
  zoneStates: Record<string, ZoneStateUpdateMessage>;
  connectionStatus: ConnectionStatus;
  criticalTransitions: CriticalTransitionEvent[];
  applyZoneUpdate: (msg: ZoneStateUpdateMessage) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

let nextEventId = 0;

export const useLiveZoneStore = create<LiveZoneState>((set) => ({
  zoneStates: {},
  connectionStatus: "offline",
  criticalTransitions: [],
  applyZoneUpdate: (msg) =>
    set((state) => {
      const key = String(msg.zone_id);
      const prevMsg = state.zoneStates[key];
      const prevState = prevMsg?.current_state;
      const isNewCritical = msg.current_state === "CRITICAL" && prevState !== "CRITICAL";

      let nextTransitions = state.criticalTransitions;
      if (isNewCritical) {
        const entry: CriticalTransitionEvent = {
          eventId: nextEventId++,
          zoneId: key,
          zoneName: msg.zone_name || `Zone ${msg.zone_id}`,
          timestamp: msg.triggered_at ? new Date(msg.triggered_at).getTime() : Date.now(),
        };
        nextTransitions = [...state.criticalTransitions, entry];
      }

      return {
        zoneStates: {
          ...state.zoneStates,
          [key]: msg,
        },
        criticalTransitions: nextTransitions,
      };
    }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
