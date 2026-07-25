import { useEffect, useState, useRef, useCallback, type ReactNode, type CSSProperties } from "react";
import { Flame, Wind, Droplet, Users, Unplug, AlertOctagon, RefreshCw } from "lucide-react";
import { useLiveZoneStore } from "../store/liveZoneStore";
import { STATUS_META, type Status } from "../components/scs/status";
import type { ZoneStateUpdateMessage } from "../types/ws-messages";
import "../styles/critical-motion.css";

export interface ZoneOutData {
  id: number;
  name: string;
  lab_type: string;
  current_state: "SAFE" | "WARNING" | "CRITICAL";
  last_seen_at: string | null;
}

const ZONE_OFFLINE_THRESHOLD_SECONDS = 5;
const TILE_H = 176; // px

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-[var(--space-3)]">{children}</div>;
}

function TileShell({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      className={`relative rounded-[var(--radius-tile)] p-[var(--space-4)] border-2 overflow-hidden flex flex-col transition-all ${className || ""}`}
      style={{ height: TILE_H, background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", ...style }}
    >
      {children}
    </div>
  );
}

interface HazardSubIndicatorsProps {
  wsUpdate?: ZoneStateUpdateMessage;
}

function HazardSubIndicators({ wsUpdate }: HazardSubIndicatorsProps) {
  const breakdown = wsUpdate?.risk_breakdown;
  const isFireActive = (breakdown?.fire_contribution ?? 0) > 5.0;
  const isGasActive = (breakdown?.gas_contribution ?? 0) > 5.0;
  const isWaterActive = (breakdown?.water_contribution ?? 0) > 5.0;
  const isOccActive = (breakdown?.occupancy_multiplier_applied ?? 1.0) > 1.0;

  const hazards = [
    { key: "fire", icon: Flame, label: "Fire", active: isFireActive, activeColor: "var(--color-status-critical)" },
    { key: "gas", icon: Wind, label: "Gas", active: isGasActive, activeColor: "var(--color-status-warning)" },
    { key: "water", icon: Droplet, label: "Water", active: isWaterActive, activeColor: "var(--color-focus-ring)" },
    { key: "occupancy", icon: Users, label: "Occupancy", active: isOccActive, activeColor: "var(--color-status-safe)" },
  ];

  return (
    <div className="grid grid-cols-4 gap-[var(--space-2)] mt-auto">
      {hazards.map((h) => {
        const Icon = h.icon;
        return (
          <div key={h.key} className="flex flex-col items-center gap-[var(--space-1)]">
            <div
              className="grid place-items-center rounded-[var(--radius-control)] w-full py-[var(--space-1)] transition-colors"
              style={{
                background: h.active ? h.activeColor : "var(--color-surface-border)",
              }}
            >
              <Icon size={16} color={h.active ? "var(--color-status-onstatus)" : "var(--color-text-muted)"} />
            </div>
            <span className="ts-xs" style={{ color: "var(--color-text-muted)" }}>{h.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ZoneTile({
  zone,
  isDegraded,
  isOffline,
  justEnteredCritical,
}: {
  zone: ZoneOutData;
  isDegraded: boolean;
  isOffline: boolean;
  justEnteredCritical: boolean;
}) {
  const wsUpdate = useLiveZoneStore((state) => state.zoneStates[String(zone.id)]);

  const rawState = wsUpdate?.current_state || zone.current_state;
  const status: Status = isOffline ? "offline" : (rawState.toLowerCase() as Status);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const isCriticalState = rawState === "CRITICAL" && !isOffline;

  const hatch = "repeating-linear-gradient(45deg, rgba(148,163,184,0.14) 0, rgba(148,163,184,0.14) 6px, transparent 6px, transparent 12px)";

  if (isOffline) {
    return (
      <TileShell style={{ borderColor: "var(--color-status-offline)" }}>
        <div className="ts-base font-medium truncate mb-[var(--space-3)]">{zone.name}</div>
        <span
          className="ts-sm inline-flex items-center gap-[var(--space-2)] self-start rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]"
          style={{ background: "var(--color-status-offline)", color: "var(--color-status-onstatus)" }}
        >
          <Unplug size={14} /> OFFLINE
        </span>
        <div className="mt-auto flex items-center justify-center gap-[var(--space-2)] ts-sm" style={{ color: "var(--color-text-muted)" }}>
          <Unplug size={20} /> No sensor connection
        </div>
      </TileShell>
    );
  }

  return (
    <TileShell
      style={{ borderColor: meta.token }}
      className={`${isCriticalState ? "critical-active" : ""} ${justEnteredCritical ? "critical-entrance" : ""}`}
    >
      <div className="flex items-center justify-between mb-[var(--space-3)]">
        <span className="ts-base font-medium truncate">{zone.name}</span>
        {wsUpdate && (
          <span className="ts-xs ts-num font-semibold" style={{ color: meta.token }}>
            Risk {wsUpdate.risk_score.toFixed(1)}
          </span>
        )}
      </div>

      <span
        className="ts-sm inline-flex items-center gap-[var(--space-2)] self-start rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]"
        style={{ background: meta.token, color: "var(--color-status-onstatus)" }}
      >
        <Icon size={14} /> {meta.label}
      </span>

      <HazardSubIndicators wsUpdate={wsUpdate} />

      {isDegraded && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: hatch }} />
          <span
            className="absolute top-[var(--space-2)] right-[var(--space-2)] ts-xs inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]"
            style={{ background: "var(--color-status-warning)", color: "var(--color-status-onstatus)" }}
          >
            <RefreshCw size={11} className="animate-spin" /> stale — reconnecting
          </span>
        </>
      )}
    </TileShell>
  );
}

export function ZoneMapView() {
  const [zones, setZones] = useState<ZoneOutData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineZones, setOfflineZones] = useState<Set<number>>(new Set());
  const [justEnteredCritical, setJustEnteredCritical] = useState<Set<number>>(new Set());

  const connectionStatus = useLiveZoneStore((state) => state.connectionStatus);
  const zoneStates = useLiveZoneStore((state) => state.zoneStates);

  const prevStatesRef = useRef<Record<number, string>>({});
  const prevOfflineRef = useRef<Record<number, boolean>>({});

  const isDegraded = connectionStatus === "reconnecting";

  const fetchZones = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/zones");
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      setZones(data.zones || []);
    } catch (err) {
      console.error("Failed to load zone list:", err);
      setError("Couldn't load zone data — click Retry to reconnect.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Track CRITICAL state entrances
  useEffect(() => {
    if (!zones) return;
    zones.forEach((z) => {
      const wsUpdate = zoneStates[String(z.id)];
      const current = wsUpdate?.current_state || z.current_state;
      const prev = prevStatesRef.current[z.id];

      if (prev && prev !== "CRITICAL" && current === "CRITICAL") {
        setJustEnteredCritical((prevSet) => new Set(prevSet).add(z.id));
        setTimeout(() => {
          setJustEnteredCritical((prevSet) => {
            const nextSet = new Set(prevSet);
            nextSet.delete(z.id);
            return nextSet;
          });
        }, 1100);
      }
      prevStatesRef.current[z.id] = current;
    });
  }, [zones, zoneStates]);

  // 2-second interval offline staleness check
  useEffect(() => {
    if (!zones) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const newOffline = new Set<number>();

      zones.forEach((z) => {
        const wsUpdate = zoneStates[String(z.id)];
        let lastSeenTimestamp = 0;

        if (wsUpdate?.triggered_at) {
          lastSeenTimestamp = new Date(wsUpdate.triggered_at).getTime();
        } else if (z.last_seen_at) {
          lastSeenTimestamp = new Date(z.last_seen_at).getTime();
        }

        const isStale = !lastSeenTimestamp || (now - lastSeenTimestamp) / 1000 > ZONE_OFFLINE_THRESHOLD_SECONDS;
        if (isStale) {
          newOffline.add(z.id);
        }

        // Auditability log on transition into/out of OFFLINE
        const wasOffline = !!prevOfflineRef.current[z.id];
        if (wasOffline !== isStale) {
          console.log(
            `[Zone Offline Check] Zone ${z.name} (ID: ${z.id}) transition: ${wasOffline ? "OFFLINE" : "ONLINE"} -> ${
              isStale ? "OFFLINE" : "ONLINE"
            } at ${new Date().toISOString()}`
          );
          prevOfflineRef.current[z.id] = isStale;
        }
      });

      setOfflineZones(newOffline);
    }, 2000);

    return () => clearInterval(interval);
  }, [zones, zoneStates]);

  // 1. Idle / Loading State
  if (isLoading && !zones) {
    return (
      <Grid>
        {[1, 2, 3, 4, 5].map((i) => (
          <TileShell key={i}>
            <div className="h-6 w-2/3 rounded-[var(--radius-control)] animate-pulse mb-[var(--space-3)]" style={{ background: "var(--color-surface-border)" }} />
            <div className="h-8 w-24 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
            <HazardSubIndicators />
          </TileShell>
        ))}
      </Grid>
    );
  }

  // 2. Error State & Render Grid
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {error && (
        <div
          className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-tile)] p-[var(--space-4)] border-2"
          style={{ borderColor: "var(--color-status-critical)", background: "var(--color-surface-card)" }}
        >
          <AlertOctagon size={20} color="var(--color-status-critical)" />
          <span className="ts-sm flex-1">{error}</span>
          <button
            onClick={fetchZones}
            className="focus-ring ts-sm inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] cursor-pointer hover:opacity-90"
            style={{ background: "var(--color-status-critical)", color: "var(--color-status-onstatus)" }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {zones && zones.length > 0 ? (
        <Grid>
          {zones.map((z) => (
            <ZoneTile
              key={z.id}
              zone={z}
              isDegraded={isDegraded}
              isOffline={offlineZones.has(z.id)}
              justEnteredCritical={justEnteredCritical.has(z.id)}
            />
          ))}
        </Grid>
      ) : (
        !error && (
          <div className="ts-sm p-[var(--space-6)] text-center rounded-[var(--radius-tile)] border" style={{ color: "var(--color-text-muted)", borderColor: "var(--color-surface-border)" }}>
            No zones configured.
          </div>
        )
      )}
    </div>
  );
}
