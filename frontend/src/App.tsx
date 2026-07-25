import { useState, useRef } from "react";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { PriorityQueueRail, type RankedZoneOut } from "./components/PriorityQueueRail";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { useDashboardSocket } from "./hooks/useDashboardSocket";
import { LoginView } from "./views/LoginView";
import { ZoneMapView } from "./views/ZoneMapView";
import { IncidentHistoryView } from "./views/IncidentHistoryView";
import { SystemHealthView } from "./views/SystemHealthView";

/* App Shell Root layout containing Sidebar + TopBar + main viewport Outlet + Priority Queue Rail */
function AppLayout() {
  // Mount WS socket ONCE at the root shell
  useDashboardSocket();

  const [rankedZones, setRankedZones] = useState<RankedZoneOut[]>([]);
  const railRefetchRef = useRef<(() => void) | null>(null);

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: "var(--color-bg-base)", color: "var(--color-text-primary)", fontFamily: "Inter, sans-serif" }}
    >
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* TopBar */}
        <TopBar
          rankedZones={rankedZones}
          onRefetchPriorityQueue={() => railRefetchRef.current?.()}
        />

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
              <PriorityQueueRail
                onRankedDataChange={setRankedZones}
                refetchRef={railRefetchRef}
              />
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
