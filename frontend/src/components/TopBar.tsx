import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Volume2, VolumeX, CheckCheck, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { useLiveZoneStore } from "../store/liveZoneStore";
import type { RankedZoneOut } from "./PriorityQueueRail";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Zone Map",
  "/incidents": "Incident History",
  "/admin/system-health": "System Health",
};

interface TopBarProps {
  rankedZones?: RankedZoneOut[];
  onRefetchPriorityQueue?: () => void;
}

export function TopBar({ rankedZones = [], onRefetchPriorityQueue }: TopBarProps) {
  const location = useLocation();
  const viewTitle = ROUTE_TITLES[location.pathname] || "Zone Map";

  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);

  const isMuted = useUIStore((state) => state.isMuted);
  const toggleMute = useUIStore((state) => state.toggleMute);

  const connectionStatus = useLiveZoneStore((state) => state.connectionStatus);
  const zoneStates = useLiveZoneStore((state) => state.zoneStates);

  const [zoneCounts, setZoneCounts] = useState<{ safe: number; attention: number }>({
    safe: 0,
    attention: 0,
  });
  const [isAckingAll, setIsAckingAll] = useState(false);

  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch GET /api/v1/zones for system-state summary pill
  const fetchZoneSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/zones");
      if (!res.ok) return;
      const data = await res.json();
      const zones = data.zones || [];

      let safe = 0;
      let attention = 0;

      zones.forEach((z: { current_state: string }) => {
        if (z.current_state === "SAFE") {
          safe += 1;
        } else if (z.current_state === "WARNING" || z.current_state === "CRITICAL") {
          attention += 1;
        }
      });

      setZoneCounts({ safe, attention });
    } catch (err) {
      console.error("Failed to fetch zone summary for top bar:", err);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchZoneSummary();
  }, [fetchZoneSummary]);

  // Debounced 250ms refetch trigger on WS zoneStates activity
  useEffect(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = setTimeout(() => {
      fetchZoneSummary();
    }, 250);

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [zoneStates, fetchZoneSummary]);

  // Handle "Acknowledge all visible critical" button (ADMIN only)
  const handleAckAll = async () => {
    if (!token || isAckingAll) return;

    // Filter CRITICAL zones that have an unacknowledged incident
    const criticalIncidents = rankedZones
      .filter((z) => z.current_state === "CRITICAL" && z.latest_incident_id && !z.acknowledged)
      .map((z) => z.latest_incident_id as number);

    if (criticalIncidents.length === 0) return;

    setIsAckingAll(true);

    try {
      const ackPromises = criticalIncidents.map(async (incId) => {
        const res = await fetch(`/api/v1/incidents/${incId}/acknowledge`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        const resData = await res.json().catch(() => null);
        console.log(`[Ack All] Incident ${incId} response:`, resData);
        return { incId, status: res.status, data: resData };
      });

      await Promise.all(ackPromises);

      // Trigger refetch of priority queue and zone summary
      onRefetchPriorityQueue?.();
      fetchZoneSummary();
    } catch (err) {
      console.error("Failed executing Ack All:", err);
    } finally {
      setIsAckingAll(false);
    }
  };

  const connMeta = {
    live: { label: "Live", token: "var(--color-status-safe)", icon: Wifi },
    reconnecting: { label: "Reconnecting", token: "var(--color-status-warning)", icon: Loader2 },
    offline: { label: "Offline", token: "var(--color-status-offline)", icon: WifiOff },
    connecting: { label: "Connecting", token: "var(--color-status-warning)", icon: Loader2 },
  }[connectionStatus] || { label: "Live", token: "var(--color-status-safe)", icon: Wifi };

  const ConnIcon = connMeta.icon;

  return (
    <header
      className="flex items-center gap-[var(--space-4)] px-[var(--space-6)] shrink-0 border-b"
      style={{
        height: "var(--topbar-height)",
        background: "var(--color-surface-raised)",
        borderColor: "var(--color-surface-border)",
      }}
    >
      {/* Left Region: View Title */}
      <span className="ts-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
        {viewTitle}
      </span>

      {/* Center Region: System State Summary Pill */}
      <div className="flex-1 flex justify-center">
        <span
          className="ts-xs rounded-[var(--radius-pill)] px-[var(--space-4)] py-[var(--space-1)] inline-flex items-center gap-[var(--space-2)]"
          style={{ background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}
        >
          <span
            className="rounded-[var(--radius-pill)] shrink-0"
            style={{
              width: 6,
              height: 6,
              background: connMeta.token,
              boxShadow: connectionStatus === "live" ? `0 0 0 3px color-mix(in srgb, ${connMeta.token} 25%, transparent)` : "none",
            }}
          />
          {zoneCounts.safe} zones nominal, {zoneCounts.attention} zones need attention
        </span>
      </div>

      {/* Right Region: Connection, Mute Toggle, Ack All (Admin Only), Logout */}
      <div className="flex items-center gap-[var(--space-3)]">
        <span className="ts-xs inline-flex items-center gap-[var(--space-2)]" style={{ color: connMeta.token }}>
          <ConnIcon size={14} className={connectionStatus === "reconnecting" || connectionStatus === "connecting" ? "animate-spin" : ""} />
          {connMeta.label}
        </span>

        {/* Mute Toggle Icon Button */}
        <button
          onClick={toggleMute}
          className="focus-ring rounded-[var(--radius-control)] p-[var(--space-2)] transition-colors cursor-pointer"
          style={{ color: isMuted ? "var(--color-status-warning)" : "var(--color-text-muted)" }}
          aria-label={isMuted ? "Unmute alerts" : "Mute alerts"}
          title={isMuted ? "Unmute alerts" : "Mute alerts"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Admin-only Acknowledge All Visible Critical Button */}
        {role === "ADMIN" && (
          <button
            onClick={handleAckAll}
            disabled={isAckingAll}
            className="focus-ring ts-xs inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] font-medium cursor-pointer hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--color-status-critical)", color: "var(--color-status-onstatus)" }}
            aria-label="Acknowledge all visible critical incidents"
          >
            <CheckCheck size={14} />
            {isAckingAll ? "Acking…" : "Ack all"}
          </button>
        )}

        {/* Logout Button */}
        <button
          onClick={logout}
          className="focus-ring ts-xs font-medium rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] border cursor-pointer hover:opacity-80"
          style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-muted)" }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
