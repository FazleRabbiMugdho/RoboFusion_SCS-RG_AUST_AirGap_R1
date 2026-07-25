import { Flame, Wind, Droplet, Users, Unplug, AlertOctagon, RefreshCw } from "lucide-react";
import { STATUS_META, type Status } from "./status";

type Hazard = { key: string; icon: typeof Flame; label: string };
const HAZARDS: Hazard[] = [
  { key: "fire", icon: Flame, label: "Fire" },
  { key: "gas", icon: Wind, label: "Gas" },
  { key: "water", icon: Droplet, label: "Water" },
  { key: "occupancy", icon: Users, label: "Occupancy" },
];

type Zone = { id: string; name: string; status: Status; hazards: Status[] };

const ZONES: Zone[] = [
  { id: "z1", name: "Lab A — Assembly", status: "safe", hazards: ["safe", "safe", "safe", "warning"] },
  { id: "z2", name: "Lab B — Battery Bay", status: "critical", hazards: ["critical", "warning", "safe", "warning"] },
  { id: "z3", name: "Lab C — Cleanroom", status: "warning", hazards: ["safe", "warning", "safe", "safe"] },
  { id: "z4", name: "Lab D — Storage", status: "safe", hazards: ["safe", "safe", "safe", "safe"] },
  { id: "z5", name: "Lab E — Testing", status: "safe", hazards: ["safe", "safe", "warning", "safe"] },
];

const TILE_H = 176; // px — fixed so Idle/Loading, Success, Degraded and Offline never reflow

/* Grid wrapper — fixed 3-up grid, 12px gaps (space/3). */
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-[var(--space-3)]">{children}</div>;
}

function TileShell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="relative rounded-[var(--radius-tile)] p-[var(--space-4)] border-2 overflow-hidden flex flex-col"
      style={{ height: TILE_H, background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", ...style }}
    >
      {children}
    </div>
  );
}

function HazardRow({ hazards, muted }: { hazards?: Status[]; muted?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-[var(--space-2)] mt-auto">
      {HAZARDS.map((h, i) => {
        const Icon = h.icon;
        const s = hazards?.[i];
        return (
          <div key={h.key} className="flex flex-col items-center gap-[var(--space-1)]">
            <div
              className="grid place-items-center rounded-[var(--radius-control)] w-full py-[var(--space-1)]"
              style={{ background: muted ? "var(--color-surface-border)" : s ? STATUS_META[s].token : "var(--color-surface-border)" }}
            >
              <Icon size={16} color={muted ? "var(--color-text-muted)" : "var(--color-status-onstatus)"} />
            </div>
            <span className="ts-xs" style={{ color: "var(--color-text-muted)" }}>{h.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 1. Idle / Loading ─────────────────────────────────────── */
export function ZoneMapLoading() {
  return (
    <Grid>
      {ZONES.slice(0, 3).map((z) => (
        <TileShell key={z.id}>
          <div className="h-6 w-2/3 rounded-[var(--radius-control)] animate-pulse mb-[var(--space-3)]" style={{ background: "var(--color-surface-border)" }} />
          <div className="h-8 w-24 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
          <HazardRow muted />
        </TileShell>
      ))}
    </Grid>
  );
}

/* ─── 2. Success ────────────────────────────────────────────── */
export function ZoneMapSuccess() {
  return (
    <Grid>
      {ZONES.map((z) => {
        const meta = STATUS_META[z.status];
        const Icon = meta.icon;
        return (
          <TileShell key={z.id} style={{ borderColor: meta.token }}>
            <div className="flex items-center justify-between mb-[var(--space-3)]">
              <span className="ts-base font-medium truncate">{z.name}</span>
            </div>
            <span className="ts-sm inline-flex items-center gap-[var(--space-2)] self-start rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]" style={{ background: meta.token, color: "var(--color-status-onstatus)" }}>
              <Icon size={14} /> {meta.label}
            </span>
            <HazardRow hazards={z.hazards} />
          </TileShell>
        );
      })}
    </Grid>
  );
}

/* ─── 3. Degraded / Reconnecting ────────────────────────────── */
export function ZoneMapDegraded() {
  const hatch = "repeating-linear-gradient(45deg, rgba(148,163,184,0.14) 0, rgba(148,163,184,0.14) 6px, transparent 6px, transparent 12px)";
  return (
    <Grid>
      {ZONES.map((z) => {
        const meta = STATUS_META[z.status];
        const Icon = meta.icon;
        return (
          <TileShell key={z.id} style={{ borderColor: meta.token }}>
            <div className="ts-base font-medium truncate mb-[var(--space-3)]">{z.name}</div>
            <span className="ts-sm inline-flex items-center gap-[var(--space-2)] self-start rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]" style={{ background: meta.token, color: "var(--color-status-onstatus)" }}>
              <Icon size={14} /> {meta.label}
            </span>
            <HazardRow hazards={z.hazards} />
            {/* diagonal-hatched overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: hatch }} />
            <span className="absolute top-[var(--space-2)] right-[var(--space-2)] ts-xs inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]" style={{ background: "var(--color-status-warning)", color: "var(--color-status-onstatus)" }}>
              <RefreshCw size={11} /> stale — reconnecting
            </span>
          </TileShell>
        );
      })}
    </Grid>
  );
}

/* ─── 4. Zone Offline (single tile, siblings unaffected) ────── */
export function ZoneMapOffline() {
  return (
    <Grid>
      {ZONES.map((z, i) => {
        if (i === 1) {
          return (
            <TileShell key={z.id} style={{ borderColor: "var(--color-status-offline)" }}>
              <div className="ts-base font-medium truncate mb-[var(--space-3)]">{z.name}</div>
              <span className="ts-sm inline-flex items-center gap-[var(--space-2)] self-start rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]" style={{ background: "var(--color-status-offline)", color: "var(--color-status-onstatus)" }}>
                <Unplug size={14} /> OFFLINE
              </span>
              <div className="mt-auto flex items-center justify-center gap-[var(--space-2)] ts-sm" style={{ color: "var(--color-text-muted)" }}>
                <Unplug size={20} /> No sensor connection
              </div>
            </TileShell>
          );
        }
        const meta = STATUS_META[z.status];
        const Icon = meta.icon;
        return (
          <TileShell key={z.id} style={{ borderColor: meta.token }}>
            <div className="ts-base font-medium truncate mb-[var(--space-3)]">{z.name}</div>
            <span className="ts-sm inline-flex items-center gap-[var(--space-2)] self-start rounded-[var(--radius-control)] px-[var(--space-2)] py-[2px]" style={{ background: meta.token, color: "var(--color-status-onstatus)" }}>
              <Icon size={14} /> {meta.label}
            </span>
            <HazardRow hazards={z.hazards} />
          </TileShell>
        );
      })}
    </Grid>
  );
}

/* ─── 5. Error (inline banner above last-loaded grid) ───────── */
export function ZoneMapError() {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div
        className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-tile)] p-[var(--space-4)] border-2"
        style={{ borderColor: "var(--color-status-critical)", background: "var(--color-surface-card)" }}
      >
        <AlertOctagon size={20} color="var(--color-status-critical)" />
        <span className="ts-sm flex-1">Couldn't load zone data — showing last known values.</span>
        <button className="focus-ring ts-sm inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] cursor-pointer" style={{ background: "var(--color-status-critical)", color: "var(--color-status-onstatus)" }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
      <div style={{ opacity: 0.6 }}>
        <ZoneMapSuccess />
      </div>
    </div>
  );
}
