import { useEffect, useState, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Download, FilterX, AlertOctagon, RefreshCw, CheckCheck, Flame, Wind, Droplet, Users } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { STATUS_META, type Status } from "../components/scs/status";

export interface IncidentHistoryItem {
  id: number;
  zone_id: number;
  zone_name: string;
  status: "SAFE" | "WARNING" | "CRITICAL";
  primary_hazard_type: "FLAME" | "GAS" | "WATER" | "OCCUPANCY" | null;
  risk_score: number;
  triggered_at: string;
  acknowledged_by_username: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  duration_seconds: number;
}

interface ZoneOption {
  id: number;
  name: string;
}

function formatDuration(seconds: number, isResolved: boolean): string {
  if (!isResolved) return "ongoing";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

function HazardBadge({ type }: { type: string | null }) {
  if (!type) return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
  const meta = {
    FLAME: { label: "Fire", icon: Flame, color: "var(--color-status-critical)" },
    GAS: { label: "Gas", icon: Wind, color: "var(--color-status-warning)" },
    WATER: { label: "Water", icon: Droplet, color: "var(--color-focus-ring)" },
    OCCUPANCY: { label: "Occupancy", icon: Users, color: "var(--color-status-safe)" },
  }[type] || { label: type, icon: Flame, color: "var(--color-text-muted)" };

  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 ts-xs font-medium" style={{ color: meta.color }}>
      <Icon size={14} />
      {meta.label}
    </span>
  );
}

export function IncidentHistoryView() {
  const token = useAuthStore((state) => state.token);

  // Zone list for dropdown
  const [zones, setZones] = useState<ZoneOption[]>([]);

  // Filter State
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedHazard, setSelectedHazard] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Data & Pagination State
  const [incidents, setIncidents] = useState<IncidentHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch zone list once on mount
  useEffect(() => {
    fetch("/api/v1/zones")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.zones) setZones(data.zones);
      })
      .catch((err) => console.error("Failed to load zones for filter:", err));
  }, []);

  // Fetch Incidents
  const fetchIncidents = useCallback(
    async (cursor: string | null = null, append: boolean = false) => {
      if (!token) return;
      if (append) {
        setIsFetchingNextPage(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (selectedZoneId) params.append("zone_id", selectedZoneId);
      if (selectedHazard) params.append("hazard_type", selectedHazard);
      if (selectedStatus) params.append("status", selectedStatus);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      if (cursor) params.append("cursor", cursor);
      params.append("limit", "50");

      try {
        const res = await fetch(`/api/v1/incidents?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.detail || `Server returned ${res.status}`);
        }

        const data = await res.json();
        const newItems: IncidentHistoryItem[] = data.incidents || [];

        setIncidents((prev) => (append ? [...prev, ...newItems] : newItems));
        setNextCursor(data.next_cursor || null);
      } catch (err: any) {
        console.error("Failed to load incidents:", err);
        setError(err.message || "Failed to load incidents — click Retry to try again.");
      } finally {
        setIsLoading(false);
        setIsFetchingNextPage(false);
      }
    },
    [token, selectedZoneId, selectedHazard, selectedStatus, dateFrom, dateTo]
  );

  // Initial & Filter change fetch
  useEffect(() => {
    fetchIncidents(null, false);
  }, [fetchIncidents]);

  // Virtualizer for smooth rendering of hundreds of items
  const rowVirtualizer = useVirtualizer({
    count: incidents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  // Infinite Scroll Trigger
  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    if (virtualItems.length === 0 || !nextCursor || isFetchingNextPage || isLoading) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index >= incidents.length - 5) {
      fetchIncidents(nextCursor, true);
    }
  }, [virtualItems, incidents.length, nextCursor, isFetchingNextPage, isLoading, fetchIncidents]);

  // Clear Filters Handler
  const handleClearFilters = () => {
    setSelectedZoneId("");
    setSelectedHazard("");
    setSelectedStatus("");
    setDateFrom("");
    setDateTo("");
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (incidents.length === 0) return;

    const headers = [
      "ID",
      "Zone Name",
      "Status",
      "Primary Hazard",
      "Risk Score",
      "Triggered At",
      "Acknowledged By",
      "Resolved At",
      "Duration",
    ];

    const csvRows = incidents.map((item) => [
      item.id,
      `"${item.zone_name.replace(/"/g, '""')}"`,
      item.status,
      item.primary_hazard_type || "N/A",
      item.risk_score,
      `"${new Date(item.triggered_at).toLocaleString()}"`,
      `"${item.acknowledged_by_username || "Unacknowledged"}"`,
      item.resolved_at ? `"${new Date(item.resolved_at).toLocaleString()}"` : "Ongoing",
      `"${formatDuration(item.duration_seconds, !!item.resolved_at)}"`,
    ]);

    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `incidents_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters =
    selectedZoneId !== "" || selectedHazard !== "" || selectedStatus !== "" || dateFrom !== "" || dateTo !== "";

  return (
    <div className="flex flex-col h-full gap-[var(--space-4)]">
      {/* Title & Actions Bar */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="ts-xl font-semibold">Incident History Log</h2>
          <p className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
            Filterable timeline showing SAFE → WARNING → CRITICAL state transitions and staff acknowledgments.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={incidents.length === 0}
          className="focus-ring ts-sm inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] border font-medium cursor-pointer hover:opacity-80 disabled:opacity-40"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div
        className="grid grid-cols-6 gap-[var(--space-3)] p-[var(--space-4)] rounded-[var(--radius-tile)] border shrink-0 items-end"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        {/* Zone Dropdown */}
        <div className="flex flex-col gap-1">
          <label className="ts-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Zone</label>
          <select
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            className="focus-ring ts-sm rounded-[var(--radius-control)] px-[var(--space-2)] py-[var(--space-1)] border bg-[var(--color-surface-card)]"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
          >
            <option value="">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>

        {/* Hazard Dropdown */}
        <div className="flex flex-col gap-1">
          <label className="ts-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Hazard Type</label>
          <select
            value={selectedHazard}
            onChange={(e) => setSelectedHazard(e.target.value)}
            className="focus-ring ts-sm rounded-[var(--radius-control)] px-[var(--space-2)] py-[var(--space-1)] border bg-[var(--color-surface-card)]"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
          >
            <option value="">All Hazards</option>
            <option value="FLAME">Fire (Flame)</option>
            <option value="GAS">Gas (MQ-2)</option>
            <option value="WATER">Water Level</option>
            <option value="OCCUPANCY">Occupancy</option>
          </select>
        </div>

        {/* Status Dropdown */}
        <div className="flex flex-col gap-1">
          <label className="ts-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="focus-ring ts-sm rounded-[var(--radius-control)] px-[var(--space-2)] py-[var(--space-1)] border bg-[var(--color-surface-card)]"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
          >
            <option value="">All States</option>
            <option value="SAFE">SAFE</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label className="ts-xs font-medium" style={{ color: "var(--color-text-muted)" }}>From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="focus-ring ts-sm rounded-[var(--radius-control)] px-[var(--space-2)] py-[var(--space-1)] border bg-[var(--color-surface-card)]"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label className="ts-xs font-medium" style={{ color: "var(--color-text-muted)" }}>To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="focus-ring ts-sm rounded-[var(--radius-control)] px-[var(--space-2)] py-[var(--space-1)] border bg-[var(--color-surface-card)]"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
          />
        </div>

        {/* Clear Filters Button */}
        <div>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="focus-ring ts-sm w-full inline-flex items-center justify-center gap-[var(--space-1)] rounded-[var(--radius-control)] px-[var(--space-2)] py-[var(--space-1)] border cursor-pointer hover:opacity-80"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-muted)" }}
            >
              <FilterX size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div
          className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-tile)] p-[var(--space-4)] border-2 shrink-0"
          style={{ borderColor: "var(--color-status-critical)", background: "var(--color-surface-card)" }}
        >
          <AlertOctagon size={20} color="var(--color-status-critical)" />
          <span className="ts-sm flex-1">{error}</span>
          <button
            onClick={() => fetchIncidents(null, false)}
            className="focus-ring ts-sm inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] cursor-pointer hover:opacity-90"
            style={{ background: "var(--color-status-critical)", color: "var(--color-status-onstatus)" }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Table Container */}
      <div
        className="flex-1 min-h-0 border rounded-[var(--radius-tile)] flex flex-col overflow-hidden"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        {/* Table Header (Always Rendered Immediately) */}
        <div
          className="grid grid-cols-7 gap-4 px-6 py-3 border-b ts-xs font-semibold uppercase tracking-wider shrink-0"
          style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-muted)" }}
        >
          <div>Zone</div>
          <div>Hazard Type</div>
          <div>Status</div>
          <div>Risk Score</div>
          <div>Triggered At</div>
          <div>Acknowledged By</div>
          <div>Duration</div>
        </div>

        {/* Table Body Container */}
        <div ref={parentRef} className="flex-1 overflow-auto">
          {/* 1. Loading State */}
          {isLoading && incidents.length === 0 ? (
            <div className="flex flex-col">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="grid grid-cols-7 gap-4 px-6 py-3 border-b items-center animate-pulse"
                  style={{ borderColor: "var(--color-surface-border)" }}
                >
                  <div className="h-4 w-28 rounded bg-[var(--color-surface-border)]" />
                  <div className="h-4 w-20 rounded bg-[var(--color-surface-border)]" />
                  <div className="h-5 w-16 rounded bg-[var(--color-surface-border)]" />
                  <div className="h-4 w-12 rounded bg-[var(--color-surface-border)]" />
                  <div className="h-4 w-32 rounded bg-[var(--color-surface-border)]" />
                  <div className="h-4 w-24 rounded bg-[var(--color-surface-border)]" />
                  <div className="h-4 w-16 rounded bg-[var(--color-surface-border)]" />
                </div>
              ))}
            </div>
          ) : incidents.length === 0 && !error ? (
            /* 2. Empty-Filtered State */
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <span className="ts-base font-medium" style={{ color: "var(--color-text-muted)" }}>
                No incidents match this filter
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="focus-ring ts-sm rounded-[var(--radius-control)] px-4 py-1.5 border font-medium cursor-pointer hover:opacity-80"
                  style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-primary)" }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            /* 3. Virtualized Success Table */
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = incidents[virtualRow.index];
                if (!item) return null;

                const statusKey = item.status.toLowerCase() as Status;
                const meta = STATUS_META[statusKey] || STATUS_META.warning;
                const isAcked = !!item.acknowledged_by_username;

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-7 gap-4 px-6 py-3 border-b items-center hover:bg-[var(--color-surface-raised)] transition-colors ts-sm"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      borderColor: "var(--color-surface-border)",
                    }}
                  >
                    <div className="font-medium truncate">{item.zone_name}</div>
                    <div><HazardBadge type={item.primary_hazard_type} /></div>
                    <div>
                      <span
                        className="ts-xs inline-flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-0.5 font-medium"
                        style={{ background: meta.token, color: "var(--color-status-onstatus)" }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="ts-num font-semibold">{item.risk_score.toFixed(1)}</div>
                    <div className="ts-num text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(item.triggered_at).toLocaleString()}
                    </div>
                    <div>
                      {isAcked ? (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-acknowledged)" }}>
                          <CheckCheck size={14} /> {item.acknowledged_by_username}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Unacknowledged</span>
                      )}
                    </div>
                    <div className="ts-num font-medium">
                      {formatDuration(item.duration_seconds, !!item.resolved_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite Scroll Fetching Indicator */}
          {isFetchingNextPage && (
            <div className="p-3 text-center ts-xs flex items-center justify-center gap-2" style={{ color: "var(--color-text-muted)" }}>
              <RefreshCw size={14} className="animate-spin" /> Loading more incidents…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
