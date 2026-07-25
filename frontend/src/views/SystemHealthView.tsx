import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Zap, VolumeX, AlertOctagon, CheckCheck, RefreshCw, Unplug, Wifi } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { STATUS_META, type Status } from "../components/scs/status";
import { isZoneOffline } from "../lib/zoneOffline";

export interface ZoneHealthData {
  id: number;
  name: string;
  lab_type: string;
  current_state: string;
  ip_address: string | null;
  last_seen_at: string | null;
  is_online: boolean;
}

export function SystemHealthView() {
  const token = useAuthStore((state) => state.token);

  const [zones, setZones] = useState<ZoneHealthData[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Row-level action status feedback map { [zoneId]: { text: string; success: boolean } }
  const [rowFeedback, setRowFeedback] = useState<Record<number, { text: string; success: boolean }>>({});
  const [pendingZoneIds, setPendingZoneIds] = useState<Set<number>>(new Set());

  const fetchHealthData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/zones/health", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setZones(data.zones || []);
    } catch (err: any) {
      console.error("Failed to load zone health data:", err);
      setError(err.message || "Failed to load system health data. Click Retry to try again.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  // Handler for Test Alert ({buzzer: true, led: true, relay: true}) & Silence ({buzzer: false, led: false, relay: false})
  const handleOverride = async (zoneId: number, command: { buzzer: boolean; led: boolean; relay: boolean }) => {
    if (!token || pendingZoneIds.has(zoneId)) return;

    setPendingZoneIds((prev) => new Set(prev).add(zoneId));

    try {
      const res = await fetch(`/api/v1/admin/zones/${zoneId}/override`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      if (res.status === 409) {
        setRowFeedback((prev) => ({
          ...prev,
          [zoneId]: { text: "No IP registered for this zone", success: false },
        }));
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Failed with status ${res.status}`);
      }

      // 200 OK — Show transient (3s) row-level Dispatched checkmark
      setRowFeedback((prev) => ({
        ...prev,
        [zoneId]: { text: "Dispatched ✓", success: true },
      }));

      setTimeout(() => {
        setRowFeedback((prev) => {
          const next = { ...prev };
          delete next[zoneId];
          return next;
        });
      }, 3000);
    } catch (err: any) {
      console.error(`Override failed for zone ${zoneId}:`, err);
      setRowFeedback((prev) => ({
        ...prev,
        [zoneId]: { text: err.message || "Override failed", success: false },
      }));
    } finally {
      setPendingZoneIds((prev) => {
        const next = new Set(prev);
        next.delete(zoneId);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full gap-[var(--space-4)] anim-fade-up">
      {/* Title & Info Bar */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="ts-xl font-semibold flex items-center gap-2">
            <div
              className="grid place-items-center rounded-[var(--radius-control)]"
              style={{
                width: 28,
                height: 28,
                background: "linear-gradient(135deg, var(--color-status-safe), #22c55e)",
                boxShadow: "0 2px 8px rgba(22,163,74,0.25)",
              }}
            >
              <ShieldCheck size={16} color="var(--color-status-onstatus)" />
            </div>
            System Health & Node Diagnostics
          </h2>
          <p className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
            Admin-only hardware node connectivity monitor and manual actuator override interface.
          </p>
        </div>

        <button
          onClick={fetchHealthData}
          disabled={isLoading}
          className="focus-ring btn-lift ts-sm inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] border font-medium cursor-pointer disabled:opacity-40"
          style={{ background: "rgba(30, 41, 59, 0.6)", borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Status
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div
          className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-tile)] p-[var(--space-4)] border-2 shrink-0 anim-fade-up"
          style={{ borderColor: "var(--color-status-critical)", background: "rgba(220,38,38,0.08)", boxShadow: "var(--shadow-glow-critical)" }}
        >
          <AlertOctagon size={20} color="var(--color-status-critical)" />
          <span className="ts-sm flex-1">{error}</span>
          <button
            onClick={fetchHealthData}
            className="focus-ring btn-lift ts-sm inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] cursor-pointer"
            style={{ background: "var(--color-status-critical)", color: "var(--color-status-onstatus)" }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Table Container */}
      <div
        className="flex-1 min-h-0 border rounded-[var(--radius-tile)] flex flex-col overflow-hidden card-elevated"
        style={{
          background: "rgba(30, 41, 59, 0.5)",
          backdropFilter: "blur(8px)",
          borderColor: "var(--color-surface-border)",
        }}
      >
        {/* Table Header */}
        <div
          className="grid grid-cols-6 gap-4 px-6 py-3 border-b ts-xs font-semibold uppercase tracking-wider shrink-0"
          style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-muted)", background: "rgba(15, 23, 42, 0.3)" }}
        >
          <div>Zone</div>
          <div>Lab Type</div>
          <div>Live State</div>
          <div>Connectivity</div>
          <div>IP Address</div>
          <div>Manual Actuator Override</div>
        </div>

        {/* Table Body Container */}
        <div className="flex-1 overflow-auto">
          {isLoading && !zones ? (
            <div className="flex flex-col">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="grid grid-cols-6 gap-4 px-6 py-4 border-b items-center"
                  style={{ borderColor: "var(--color-surface-border)", animationDelay: `${i * 80}ms` }}
                >
                  <div className="h-4 w-32 rounded shimmer" />
                  <div className="h-4 w-24 rounded shimmer" />
                  <div className="h-5 w-16 rounded shimmer" />
                  <div className="h-5 w-20 rounded shimmer" />
                  <div className="h-4 w-28 rounded shimmer" />
                  <div className="h-8 w-44 rounded shimmer" />
                </div>
              ))}
            </div>
          ) : zones && zones.length > 0 ? (
            <div className="flex flex-col stagger-children">
              {zones.map((z) => {
                const statusKey = z.current_state.toLowerCase() as Status;
                const meta = STATUS_META[statusKey] || STATUS_META.warning;

                // Shared frontend offline staleness check
                const offline = isZoneOffline(z.last_seen_at);
                const isPending = pendingZoneIds.has(z.id);
                const feedback = rowFeedback[z.id];

                return (
                  <div
                    key={z.id}
                    className="grid grid-cols-6 gap-4 px-6 py-4 border-b items-center table-row-hover ts-sm"
                    style={{
                      borderColor: "var(--color-surface-border)",
                      transition: "background 200ms ease",
                    }}
                  >
                    {/* Zone Name */}
                    <div className="font-medium truncate">{z.name}</div>

                    {/* Lab Type */}
                    <div className="ts-xs uppercase font-mono" style={{ color: "var(--color-text-muted)" }}>
                      {z.lab_type.replace(/_/g, " ")}
                    </div>

                    {/* Live State Badge */}
                    <div>
                      <span
                        className="ts-xs inline-flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-0.5 font-medium"
                        style={{
                          background: meta.token,
                          color: "var(--color-status-onstatus)",
                          boxShadow: `0 2px 6px ${statusKey === "critical" ? "rgba(220,38,38,0.25)" : statusKey === "warning" ? "rgba(217,119,6,0.2)" : "rgba(22,163,74,0.2)"}`,
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    {/* Connectivity Badge */}
                    <div>
                      {offline ? (
                        <span
                          className="ts-xs inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-0.5 font-medium"
                          style={{ background: "var(--color-status-offline)", color: "var(--color-status-onstatus)" }}
                        >
                          <Unplug size={12} /> Offline
                        </span>
                      ) : (
                        <span
                          className="ts-xs inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-0.5 font-medium"
                          style={{
                            background: "var(--color-status-safe)",
                            color: "var(--color-status-onstatus)",
                            boxShadow: "0 2px 6px rgba(22,163,74,0.2)",
                          }}
                        >
                          <Wifi size={12} /> Online
                        </span>
                      )}
                    </div>

                    {/* IP Address */}
                    <div className="ts-num font-mono text-xs" style={{ color: z.ip_address ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                      {z.ip_address || "Unassigned"}
                    </div>

                    {/* Manual Actuator Override Actions & Feedback */}
                    <div className="flex items-center gap-2">
                      {feedback ? (
                        <span
                          className={`ts-xs font-medium inline-flex items-center gap-1 ${feedback.success ? "feedback-glow-success" : ""}`}
                          style={{ color: feedback.success ? "var(--color-status-safe)" : "var(--color-status-warning)" }}
                        >
                          {feedback.success && <CheckCheck size={14} />} {feedback.text}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOverride(z.id, { buzzer: true, led: true, relay: true })}
                            disabled={isPending}
                            className="focus-ring btn-lift ts-xs inline-flex items-center gap-1 rounded-[var(--radius-control)] px-2.5 py-1 font-medium cursor-pointer disabled:opacity-50"
                            style={{
                              background: "linear-gradient(135deg, var(--color-status-critical), #ef4444)",
                              color: "var(--color-status-onstatus)",
                              boxShadow: "0 2px 6px rgba(220,38,38,0.2)",
                            }}
                            title="Trigger buzzer, LED, and relay test sequence"
                          >
                            <Zap size={13} /> Test Alert
                          </button>

                          <button
                            onClick={() => handleOverride(z.id, { buzzer: false, led: false, relay: false })}
                            disabled={isPending}
                            className="focus-ring btn-lift ts-xs inline-flex items-center gap-1 rounded-[var(--radius-control)] px-2.5 py-1 font-medium border cursor-pointer disabled:opacity-50"
                            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-muted)" }}
                            title="Silence buzzer, LED, and relay"
                          >
                            <VolumeX size={13} /> Silence
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !error && (
              <div className="ts-sm p-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                No zone nodes configured.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
