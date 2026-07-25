export type ZoneState = "SAFE" | "WARNING" | "CRITICAL";

export interface RiskBreakdown {
  fire_contribution: number;
  gas_contribution: number;
  water_contribution: number;
  occupancy_multiplier_applied: number;
  total: number;
}

export interface ZoneStateUpdateMessage {
  type: "zone_state_update";
  zone_id: number;
  zone_name: string;
  current_state: ZoneState;
  previous_state: ZoneState;
  risk_score: number;
  risk_breakdown: RiskBreakdown;
  triggered_at: string;
  connection_count: number;
}