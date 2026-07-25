import { NavLink } from "react-router-dom";
import { Map, History, Activity, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";

export function Sidebar() {
  const role = useAuthStore((state) => state.role);
  const username = useAuthStore((state) => state.username);
  const isExpanded = useUIStore((state) => state.isSidebarExpanded);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const sidebarW = isExpanded ? "var(--sidebar-expanded)" : "var(--sidebar-collapsed)";

  return (
    <aside
      className="flex flex-col shrink-0 border-r relative select-none"
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
            maxWidth: isExpanded ? 140 : 0,
            opacity: isExpanded ? 1 : 0,
            transition: "max-width 200ms ease, opacity 160ms ease",
          }}
        >
          RoboFusion
        </span>
      </div>

      {/* nav links */}
      <nav className="flex-1 py-[var(--space-4)] flex flex-col gap-[var(--space-1)] px-[var(--space-2)] overflow-hidden">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `focus-ring ts-sm flex items-center gap-[var(--space-3)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] text-left w-full cursor-pointer transition-colors ${
              isActive ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`
          }
          title={!isExpanded ? "Zone Map" : undefined}
        >
          <Map size={18} className="shrink-0" />
          <span
            className="whitespace-nowrap overflow-hidden"
            style={{
              maxWidth: isExpanded ? 160 : 0,
              opacity: isExpanded ? 1 : 0,
              transition: "max-width 200ms ease, opacity 160ms ease",
            }}
          >
            Zone Map
          </span>
        </NavLink>

        <NavLink
          to="/incidents"
          className={({ isActive }) =>
            `focus-ring ts-sm flex items-center gap-[var(--space-3)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] text-left w-full cursor-pointer transition-colors ${
              isActive ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`
          }
          title={!isExpanded ? "Incident History" : undefined}
        >
          <History size={18} className="shrink-0" />
          <span
            className="whitespace-nowrap overflow-hidden"
            style={{
              maxWidth: isExpanded ? 160 : 0,
              opacity: isExpanded ? 1 : 0,
              transition: "max-width 200ms ease, opacity 160ms ease",
            }}
          >
            Incident History
          </span>
        </NavLink>

        {/* System Health link rendered strictly ONLY for ADMIN role — never rendered-and-disabled for STAFF */}
        {role === "ADMIN" && (
          <NavLink
            to="/admin/system-health"
            className={({ isActive }) =>
              `focus-ring ts-sm flex items-center gap-[var(--space-3)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] text-left w-full cursor-pointer transition-colors ${
                isActive ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`
            }
            title={!isExpanded ? "System Health" : undefined}
          >
            <Activity size={18} className="shrink-0" />
            <span
              className="whitespace-nowrap overflow-hidden"
              style={{
                maxWidth: isExpanded ? 160 : 0,
                opacity: isExpanded ? 1 : 0,
                transition: "max-width 200ms ease, opacity 160ms ease",
              }}
            >
              System Health
            </span>
          </NavLink>
        )}
      </nav>

      {/* role badge */}
      <div className="p-[var(--space-3)] border-t shrink-0 overflow-hidden" style={{ borderColor: "var(--color-surface-border)" }}>
        <div className="flex items-center gap-[var(--space-3)]">
          <div
            className="rounded-[var(--radius-pill)] shrink-0 grid place-items-center ts-xs font-semibold"
            style={{ width: 32, height: 32, background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}
          >
            {role === "ADMIN" ? "AD" : "ST"}
          </div>
          <div
            className="min-w-0 overflow-hidden"
            style={{
              maxWidth: isExpanded ? 160 : 0,
              opacity: isExpanded ? 1 : 0,
              transition: "max-width 200ms ease, opacity 160ms ease",
            }}
          >
            <div className="ts-sm font-medium truncate">{username || (role === "ADMIN" ? "Admin" : "Security Staff")}</div>
            <div className="ts-xs truncate" style={{ color: "var(--color-text-muted)" }}>{role === "ADMIN" ? "Administrator" : "Staff On Shift"}</div>
          </div>
        </div>
      </div>

      {/* collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="focus-ring absolute -right-3 top-1/2 -translate-y-1/2 grid place-items-center rounded-[var(--radius-pill)] border cursor-pointer"
        style={{
          width: 24,
          height: 24,
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
          color: "var(--color-text-muted)",
          zIndex: 10,
        }}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
      </button>
    </aside>
  );
}
