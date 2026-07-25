import { useEffect, useState, useRef, useCallback, type CSSProperties, type ReactNode } from "react";
import { CheckCircle2, Users, Clock, Flame, Wind, Droplet, CheckCheck } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useLiveZoneStore } from "../store/liveZoneStore";
import { STATUS_META, type Status } from "./scs/status";

export interface RankedZoneOut {
  zone_id: number;
  zone_name: string;
  current_state: "SAFE" | "WARNING" | "CRITICAL";
  risk_score: number;
  occupied: boolean;
  seconds_in_state: number;
  rank_reason: string;
  risk_breakdown: {
    fire_contribution?: number;
    gas_contribution?: number;
    water_contribution?: number;
    occupancy_multiplier_applied?: number;
    total?: number;
  };
  latest_incident_id: number | null;
  acknowledged: boolean;
  acknowledged_by_username: string | null;
}

const CARD_MIN_H = 128; // px

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function CardShell({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-tile)] p-[var(--space-4)] border-2 flex flex-col gap-[var(--space-3)] transition-all ${className || ""}`}
      style={{ minHeight: CARD_MIN_H, background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", ...style }}
    >
      {children}
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Clock; value: string; label: string }) {
  return (
    <div className="flex items-center gap-[var(--space-1)]" title={label}>
      <Icon size={14} style={{ color: "var(--color-text-muted)" }} />
      <span className="ts-sm ts-num">{value}</span>
    </div>
  );
}

function RankedCard({
  z,
  rank,
  onAcknowledge,
  isJustEntered,
}: {
  z: RankedZoneOut;
  rank: number;
  onAcknowledge: (incidentId: number) => void;
  isJustEntered: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isAcking, setIsAcking] = useState(false);

  const status: Status = z.current_state.toLowerCase() as Status;
  const meta = STATUS_META[status] || STATUS_META.warning;
  const Icon = meta.icon;

  const isAcked = z.acknowledged;
  const ackedUser = z.acknowledged_by_username;

  const handleAckClick = async () => {
    if (!z.latest_incident_id || isAcked || isAcking) return;
    setIsAcking(true);
    await onAcknowledge(z.latest_incident_id);
    setIsAcking(false);
  };

  const fireVal = Math.round(z.risk_breakdown?.fire_contribution ?? 0);
  const gasVal = Math.round(z.risk_breakdown?.gas_contribution ?? 0);
  const waterVal = Math.round(z.risk_breakdown?.water_contribution ?? 0);
  const occVal = Math.round((z.risk_breakdown?.occupancy_multiplier_applied ?? 1.0) * 10 - 10);

  return (
    <CardShell
      style={{ borderColor: isAcked ? "var(--color-acknowledged)" : meta.token }}
      className={isJustEntered ? "animate-critical-pulse ring-2 ring-red-500/50" : ""}
    >
      <div
        className="flex flex-col gap-[var(--space-3)] cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsHovered((v) => !v)}
      >
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="ts-sm ts-num font-semibold" style={{ color: "var(--color-text-muted)" }}>
            #{rank}
          </span>
          <span className="ts-base font-medium flex-1 truncate">{z.zone_name}</span>
          <Icon size={16} color={isAcked ? "var(--color-acknowledged)" : meta.token} />
        </div>

        <div className="flex items-center gap-[var(--space-4)]">
          <div className="flex flex-col">
            <span className="ts-2xl ts-num font-semibold" style={{ color: isAcked ? "var(--color-acknowledged)" : meta.token }}>
              {z.risk_score.toFixed(1)}
            </span>
            <span className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
              risk score
            </span>
          </div>
          <div className="flex flex-col gap-[var(--space-1)]">
            <Metric icon={Users} value={z.occupied ? "Occupied" : "Empty"} label="Occupancy status" />
            <Metric icon={Clock} value={formatElapsed(z.seconds_in_state)} label="Elapsed time in state" />
          </div>
        </div>

        {/* Hover / Tap expansion row for risk breakdown */}
        {isHovered && (
          <div className="grid grid-cols-4 gap-[var(--space-2)] pt-[var(--space-3)] border-t" style={{ borderColor: "var(--color-surface-border)" }}>
            {[
              { icon: Flame, label: "Fire", val: fireVal },
              { icon: Wind, label: "Gas", val: gasVal },
              { icon: Droplet, label: "Water", val: waterVal },
              { icon: Users, label: "Occ.", val: occVal },
            ].map((b) => {
              const BIcon = b.icon;
              return (
                <div key={b.label} className="flex flex-col items-center gap-[var(--space-1)]">
                  <BIcon size={13} style={{ color: "var(--color-text-muted)" }} />
                  <span className="ts-xs ts-num">+{b.val}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAcked ? (
        <span className="ts-sm inline-flex items-center gap-[var(--space-1)]" style={{ color: "var(--color-acknowledged)" }}>
          <CheckCheck size={14} /> Acknowledged by {ackedUser || "Staff"}
        </span>
      ) : z.latest_incident_id ? (
        <button
          onClick={handleAckClick}
          disabled={isAcking}
          className="focus-ring ts-sm rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] self-start cursor-pointer hover:opacity-90 disabled:opacity-50"
          style={{ background: meta.token, color: "var(--color-status-onstatus)" }}
        >
          {isAcking ? "Acknowledging…" : "Acknowledge"}
        </button>
      ) : null}
    </CardShell>
  );
}

export function PriorityQueueRail() {
  const [rankedZones, setRankedZones] = useState<RankedZoneOut[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChangeTime, setLastChangeTime] = useState<string | null>(null);
  const [justEnteredIds, setJustEnteredIds] = useState<Set<number>>(new Set());

  const token = useAuthStore((state) => state.token);
  const username = useAuthStore((state) => state.username);
  const zoneStates = useLiveZoneStore((state) => state.zoneStates);

  const prevIdsRef = useRef<Set<number>>(new Set());
  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPriorityRanking = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/zones/priority-ranking", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed with ${res.status}`);
      }

      const data = await res.json();
      const zonesList: RankedZoneOut[] = data.ranked_zones || [];

      // Detect newly appeared zones
      const currentIds = new Set(zonesList.map((z) => z.zone_id));
      const newlyAppeared = zonesList.filter((z) => !prevIdsRef.current.has(z.zone_id)).map((z) => z.zone_id);

      if (newlyAppeared.length > 0) {
        setJustEnteredIds((prev) => new Set([...prev, ...newlyAppeared]));
        setTimeout(() => {
          setJustEnteredIds((prev) => {
            const next = new Set(prev);
            newlyAppeared.forEach((id) => next.delete(id));
            return next;
          });
        }, 1100);
      }

      prevIdsRef.current = currentIds;
      setRankedZones(zonesList);
      setLastChangeTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Error fetching priority ranking:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPriorityRanking();
  }, [fetchPriorityRanking]);

  // Debounced 250ms refetch on WS zoneStates activity
  useEffect(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = setTimeout(() => {
      fetchPriorityRanking();
    }, 250);

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [zoneStates, fetchPriorityRanking]);

  // Handle Optimistic Acknowledge Action
  const handleAcknowledge = async (incidentId: number) => {
    if (!token) return;

    // Optimistically update local state
    setRankedZones((prev) =>
      prev
        ? prev.map((z) =>
            z.latest_incident_id === incidentId
              ? { ...z, acknowledged: true, acknowledged_by_username: username || "User" }
              : z
          )
        : prev
    );

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/acknowledge`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const resData = await res.json();
      console.log(`[Incident Ack] Incident ${incidentId} response status: ${resData?.status}`);

      if (res.ok && (resData.status === "acknowledged" || resData.status === "already_acknowledged")) {
        // Refresh server truth shortly after
        fetchPriorityRanking();
      }
    } catch (err) {
      console.error("Failed to acknowledge incident:", err);
    }
  };

  // 1. Idle / Loading State
  if (isLoading && !rankedZones) {
    return (
      <div className="flex flex-col gap-[var(--space-3)]">
        {[0, 1].map((i) => (
          <CardShell key={i}>
            <div className="h-5 w-3/4 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
            <div className="h-9 w-20 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
            <div className="h-6 w-24 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
          </CardShell>
        ))}
      </div>
    );
  }

  // 2. All-Nominal State (No active incident/warning zones)
  if (!rankedZones || rankedZones.length === 0) {
    return (
      <CardShell style={{ borderColor: "var(--color-status-safe)" }}>
        <div className="flex flex-col items-center justify-center text-center gap-[var(--space-2)] py-[var(--space-4)]">
          <CheckCircle2 size={28} color="var(--color-status-safe)" />
          <span className="ts-base font-medium">All zones nominal</span>
          {lastChangeTime && (
            <span className="ts-xs ts-num" style={{ color: "var(--color-text-muted)" }}>
              last update {lastChangeTime}
            </span>
          )}
        </div>
      </CardShell>
    );
  }

  // 3. Populated Rail State
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {rankedZones.map((z, i) => (
        <RankedCard
          key={z.zone_id}
          z={z}
          rank={i + 1}
          onAcknowledge={handleAcknowledge}
          isJustEntered={justEnteredIds.has(z.zone_id)}
        />
      ))}
    </div>
  );
}
