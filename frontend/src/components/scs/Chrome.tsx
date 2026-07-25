import type { ReactNode } from "react";
import {
  Map, History, Activity, ShieldCheck,
  Wifi, WifiOff, Loader2, Volume2, VolumeX,
  CheckCheck, ChevronLeft, ChevronRight,
} from "lucide-react";

type ConnState = "live" | "reconnecting" | "offline";
type Role = "staff" | "admin";
type NavKey = "zone" | "history" | "health";

const NAV: { key: NavKey; label: string; icon: typeof Map; adminOnly: boolean }[] = [
  { key: "zone",    label: "Zone Map",        icon: Map,      adminOnly: false },
  { key: "history", label: "Incident History", icon: History,  adminOnly: false },
  { key: "health",  label: "System Health",    icon: Activity, adminOnly: true  },
];

const CONN_META: Record<ConnState, { label: string; token: string; icon: typeof Wifi }> = {
  live:         { label: "Live",         token: "var(--color-status-safe)",    icon: Wifi    },
  reconnecting: { label: "Reconnecting", token: "var(--color-status-warning)", icon: Loader2 },
  offline:      { label: "Offline",      token: "var(--color-status-offline)", icon: WifiOff },
};

const NAV_LABELS: Record<NavKey, string> = {
  zone:    "Zone Map",
  history: "Incident History",
  health:  "System Health",
};

export function Chrome({
  children,
  queue,
  role = "admin",
  expanded = true,
  active = "zone",
  connection = "live",
  systemState = "3 zones nominal · 2 need attention",
  muted = false,
  onToggleSidebar,
  onNavChange,
  onMuteToggle,
  onAckAll,
}: {
  children: ReactNode;
  queue: ReactNode;
  role?: Role;
  expanded?: boolean;
  active?: NavKey;
  connection?: ConnState;
  systemState?: string;
  muted?: boolean;
  onToggleSidebar?: () => void;
  onNavChange?: (key: NavKey) => void;
  onMuteToggle?: () => void;
  onAckAll?: () => void;
}) {
  const conn = CONN_META[connection];
  const ConnIcon = conn.icon;

  const sidebarW = expanded ? "var(--sidebar-expanded)" : "var(--sidebar-collapsed)";

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: "var(--color-bg-base)", color: "var(--color-text-primary)", fontFamily: "Inter, sans-serif" }}
    >
      {/* ── Left sidebar ──────────────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 border-r relative"
        style={{
          width: sidebarW,
          background: "var(--color-surface-raised)",
          borderColor: "var(--color-surface-border)",
          transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* brand */}
        <div
          className="flex items-center gap-[var(--space-2)] px-[var(--space-4)] shrink-0 border-b overflow-hidden"
          style={{ height: "var(--topbar-height)", borderColor: "var(--color-surface-border)" }}
        >
          <div
            className="rounded-[var(--radius-control)] shrink-0 grid place-items-center"
            style={{ width: 32, height: 32, background: "var(--color-status-critical)" }}
          >
            <ShieldCheck size={18} color="var(--color-status-onstatus)" />
          </div>
          <span
            className="ts-base font-semibold whitespace-nowrap overflow-hidden"
            style={{
              maxWidth: expanded ? 140 : 0,
              opacity: expanded ? 1 : 0,
              transition: "max-width 200ms ease, opacity 160ms ease",
            }}
          >
            RoboFusion
          </span>
        </div>

        {/* nav */}
        <nav className="flex-1 py-[var(--space-4)] flex flex-col gap-[var(--space-1)] px-[var(--space-2)] overflow-hidden">
          {NAV.filter((n) => !n.adminOnly || role === "admin").map((n) => {
            const Icon = n.icon;
            const isActive = n.key === active;
            return (
              <button
                key={n.key}
                className="focus-ring ts-sm flex items-center gap-[var(--space-3)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] text-left w-full cursor-pointer"
                style={{
                  background: isActive ? "var(--color-surface-card)" : "transparent",
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  transition: "background 140ms ease, color 140ms ease",
                }}
                onClick={() => onNavChange?.(n.key)}
                title={!expanded ? n.label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                <span
                  className="whitespace-nowrap overflow-hidden"
                  style={{
                    maxWidth: expanded ? 160 : 0,
                    opacity: expanded ? 1 : 0,
                    transition: "max-width 200ms ease, opacity 160ms ease",
                  }}
                >
                  {n.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* role badge */}
        <div className="p-[var(--space-3)] border-t shrink-0 overflow-hidden" style={{ borderColor: "var(--color-surface-border)" }}>
          <div className="flex items-center gap-[var(--space-3)]">
            <div
              className="rounded-[var(--radius-pill)] shrink-0 grid place-items-center ts-xs font-semibold"
              style={{ width: 32, height: 32, background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}
            >
              {role === "admin" ? "AD" : "ST"}
            </div>
            <div
              className="min-w-0 overflow-hidden"
              style={{
                maxWidth: expanded ? 160 : 0,
                opacity: expanded ? 1 : 0,
                transition: "max-width 200ms ease, opacity 160ms ease",
              }}
            >
              <div className="ts-sm font-medium truncate">{role === "admin" ? "Admin" : "Security Staff"}</div>
              <div className="ts-xs truncate" style={{ color: "var(--color-text-muted)" }}>on shift</div>
            </div>
          </div>
        </div>

        {/* collapse toggle */}
        <button
          onClick={onToggleSidebar}
          className="focus-ring absolute -right-3 top-1/2 -translate-y-1/2 grid place-items-center rounded-[var(--radius-pill)] border cursor-pointer"
          style={{
            width: 24, height: 24,
            background: "var(--color-surface-card)",
            borderColor: "var(--color-surface-border)",
            color: "var(--color-text-muted)",
            zIndex: 10,
          }}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </button>
      </aside>

      {/* ── Center + right rail ────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* top bar */}
        <header
          className="flex items-center gap-[var(--space-4)] px-[var(--space-6)] shrink-0 border-b"
          style={{
            height: "var(--topbar-height)",
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-surface-border)",
          }}
        >
          <span className="ts-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            {NAV_LABELS[active]}
          </span>

          {/* centered system-state pill */}
          <div className="flex-1 flex justify-center">
            <span
              className="ts-xs rounded-[var(--radius-pill)] px-[var(--space-4)] py-[var(--space-1)] inline-flex items-center gap-[var(--space-2)]"
              style={{ background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}
            >
              <span
                className="rounded-[var(--radius-pill)] shrink-0"
                style={{
                  width: 6, height: 6,
                  background: conn.token,
                  boxShadow: connection === "live" ? `0 0 0 3px color-mix(in srgb, ${conn.token} 25%, transparent)` : "none",
                }}
              />
              {systemState}
            </span>
          </div>

          {/* right cluster */}
          <div className="flex items-center gap-[var(--space-3)]">
            <span
              className="ts-xs inline-flex items-center gap-[var(--space-2)]"
              style={{ color: conn.token }}
            >
              <ConnIcon size={14} className={connection === "reconnecting" ? "animate-spin" : ""} />
              {conn.label}
            </span>

            <button
              onClick={onMuteToggle}
              className="focus-ring rounded-[var(--radius-control)] p-[var(--space-2)] transition-colors cursor-pointer"
              style={{ color: muted ? "var(--color-status-warning)" : "var(--color-text-muted)" }}
              aria-label={muted ? "Unmute alerts" : "Mute alerts"}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {role === "admin" && (
              <button
                onClick={onAckAll}
                className="focus-ring ts-xs inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] font-medium transition-opacity hover:opacity-80 cursor-pointer"
                style={{ background: "var(--color-status-critical)", color: "var(--color-status-onstatus)" }}
              >
                <CheckCheck size={14} />
                Ack all
              </button>
            )}
          </div>
        </header>

        {/* main viewport + priority queue rail */}
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0 overflow-auto p-[var(--space-6)]">
            {children}
          </main>

          <aside
            className="shrink-0 overflow-auto border-l flex flex-col"
            style={{
              width: "var(--queue-rail)",
              background: "var(--color-surface-raised)",
              borderColor: "var(--color-surface-border)",
            }}
          >
            <div
              className="ts-xs font-semibold uppercase tracking-widest px-[var(--space-4)] py-[var(--space-3)] border-b shrink-0"
              style={{ color: "var(--color-text-muted)", borderColor: "var(--color-surface-border)" }}
            >
              Priority Queue
            </div>
            <div className="flex-1 overflow-auto p-[var(--space-4)]">
              {queue}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
