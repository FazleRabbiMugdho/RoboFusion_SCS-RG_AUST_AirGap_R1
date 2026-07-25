import { CheckCircle2, AlertTriangle, OctagonAlert, Unplug } from "lucide-react";
import type { ComponentType } from "react";

export type Status = "safe" | "warning" | "critical" | "offline";

/**
 * Status-to-color map — references ONLY semantic tokens (color/status/*).
 * Icon pairing is mandatory for every status use ("not color alone", Test Case 16b).
 */
export const STATUS_META: Record<
  Status,
  { label: string; token: string; icon: ComponentType<{ size?: number; className?: string; color?: string }> }
> = {
  safe:     { label: "SAFE",     token: "var(--color-status-safe)",     icon: CheckCircle2 },
  warning:  { label: "WARNING",  token: "var(--color-status-warning)",  icon: AlertTriangle },
  critical: { label: "CRITICAL", token: "var(--color-status-critical)", icon: OctagonAlert },
  offline:  { label: "OFFLINE",  token: "var(--color-status-offline)",  icon: Unplug },
};

/** Small status chip with mandatory icon + label on top of the status fill. */
export function StatusChip({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className="ts-xs inline-flex items-center gap-[var(--space-1)] px-[var(--space-2)] py-[2px] rounded-[var(--radius-control)]"
      style={{ background: meta.token, color: "var(--color-status-onstatus)" }}
    >
      <Icon size={12} />
      {meta.label}
    </span>
  );
}
