import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { PriorityQueueRail } from "./components/PriorityQueueRail";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { useDashboardSocket } from "./hooks/useDashboardSocket";
import { useAuthStore } from "./store/authStore";
import { useUIStore } from "./store/uiStore";
import { useLiveZoneStore } from "./store/liveZoneStore";
import { LoginView } from "./views/LoginView";
import { ZoneMapView } from "./views/ZoneMapView";
import { IncidentHistoryView } from "./views/IncidentHistoryView";
import { SystemHealthView } from "./views/SystemHealthView";
import { Volume2, VolumeX, CheckCheck, Wifi, WifiOff, Loader2 } from "lucide-react";

/* App Shell Root layout containing Sidebar + topbar + main viewport Outlet + Priority Queue */
function AppLayout() {
  // Mount WS socket ONCE at the root shell
  useDashboardSocket();

  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const isMuted = useUIStore((state) => state.isMuted);
  const toggleMute = useUIStore((state) => state.toggleMute);
  const connectionStatus = useLiveZoneStore((state) => state.connectionStatus);

  const connMeta = {
    live: { label: "Live", token: "var(--color-status-safe)", icon: Wifi },
    reconnecting: { label: "Reconnecting", token: "var(--color-status-warning)", icon: Loader2 },
    offline: { label: "Offline", token: "var(--color-status-offline)", icon: WifiOff },
    connecting: { label: "Connecting", token: "var(--color-status-warning)", icon: Loader2 },
  }[connectionStatus];

  const ConnIcon = connMeta.icon;

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: "var(--color-bg-base)", color: "var(--color-text-primary)", fontFamily: "Inter, sans-serif" }}
    >
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header
          className="flex items-center gap-[var(--space-4)] px-[var(--space-6)] shrink-0 border-b"
          style={{
            height: "var(--topbar-height)",
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-surface-border)",
          }}
        >
          <span className="ts-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            RoboFusion Command Center
          </span>

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
              RoboFusion SCS-RG Grid Active
            </span>
          </div>

          <div className="flex items-center gap-[var(--space-3)]">
            <span className="ts-xs inline-flex items-center gap-[var(--space-2)]" style={{ color: connMeta.token }}>
              <ConnIcon size={14} className={connectionStatus === "reconnecting" || connectionStatus === "connecting" ? "animate-spin" : ""} />
              {connMeta.label}
            </span>

            <button
              onClick={toggleMute}
              className="focus-ring rounded-[var(--radius-control)] p-[var(--space-2)] transition-colors cursor-pointer"
              style={{ color: isMuted ? "var(--color-status-warning)" : "var(--color-text-muted)" }}
              aria-label={isMuted ? "Unmute alerts" : "Mute alerts"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {role === "ADMIN" && (
              <button
                className="focus-ring ts-xs inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] font-medium cursor-pointer hover:opacity-80"
                style={{ background: "var(--color-status-critical)", color: "var(--color-status-onstatus)" }}
              >
                <CheckCheck size={14} />
                Ack all
              </button>
            )}

            <button
              onClick={logout}
              className="focus-ring ts-xs font-medium rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] border cursor-pointer hover:opacity-80"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-text-muted)" }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Main Viewport + Priority Queue Rail */}
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0 overflow-auto p-[var(--space-6)]">
            <Outlet />
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
              <PriorityQueueRail />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginView />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "/",
            element: <ZoneMapView />,
          },
          {
            path: "/incidents",
            element: <IncidentHistoryView />,
          },
          {
            element: <RequireRole role="ADMIN" />,
            children: [
              {
                path: "/admin/system-health",
                element: <SystemHealthView />,
              },
            ],
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
