import { create } from "zustand";
import type { ZoneStateUpdateMessage } from "../types/ws-messages";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface CriticalTransitionEvent {
  eventId: number;
  zoneId: string;
  zoneName: string;
  timestamp: number;
}

export interface RiskScoreHistoryEntry {
  score: number;
  timestamp: number;
}

const TREND_WINDOW_SIZE = 6;

interface LiveZoneState {
  zoneStates: Record<string, ZoneStateUpdateMessage>;
  connectionStatus: ConnectionStatus;
  criticalTransitions: CriticalTransitionEvent[];
  riskScoreHistory: Record<string, RiskScoreHistoryEntry[]>;
  applyZoneUpdate: (msg: ZoneStateUpdateMessage) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

let nextEventId = 0;

export const useLiveZoneStore = create<LiveZoneState>((set) => ({
  zoneStates: {},
  connectionStatus: "offline",
  criticalTransitions: [],
  riskScoreHistory: {},
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

      // Ring buffer for risk score history (max TREND_WINDOW_SIZE entries per zone)
      const history = state.riskScoreHistory[key] || [];
      const newHistory = [...history, { score: msg.risk_score, timestamp: Date.now() }];
      if (newHistory.length > TREND_WINDOW_SIZE) {
        newHistory.shift();
      }
      const nextRiskScoreHistory = {
        ...state.riskScoreHistory,
        [key]: newHistory,
      };

      return {
        zoneStates: {
          ...state.zoneStates,
          [key]: msg,
        },
        criticalTransitions: nextTransitions,
        riskScoreHistory: nextRiskScoreHistory,
      };
    }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
