import { AlertOctagon, X } from "lucide-react";
import { useUIStore } from "../store/uiStore";

export function ToastStack() {
  const toasts = useUIStore((state) => state.toasts);
  const dismissToast = useUIStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-[var(--space-2)] max-w-sm w-full pointer-events-none"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-[var(--radius-tile)] p-[var(--space-3)] border-2 shadow-xl flex items-start gap-[var(--space-3)] transition-all duration-200 ease-out animate-toast-slide"
          style={{
            background: "var(--color-surface-card)",
            borderColor: "var(--color-status-critical)",
            color: "var(--color-text-primary)",
          }}
        >
          <div
            className="rounded-[var(--radius-control)] p-1.5 shrink-0 grid place-items-center mt-0.5"
            style={{ background: "var(--color-status-critical)" }}
          >
            <AlertOctagon size={18} color="var(--color-status-onstatus)" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="ts-sm font-semibold truncate">{toast.zoneName}</span>
              <span className="ts-xs ts-num" style={{ color: "var(--color-text-muted)" }}>
                {new Date(toast.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="ts-xs font-medium" style={{ color: "var(--color-status-critical)" }}>
              New CRITICAL alert
            </p>
          </div>

          <button
            onClick={() => dismissToast(toast.id)}
            className="focus-ring p-1 rounded hover:opacity-80 text-[var(--color-text-muted)] cursor-pointer shrink-0"
            aria-label="Dismiss toast alert"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
