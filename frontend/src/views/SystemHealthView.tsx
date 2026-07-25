export function SystemHealthView() {
  return (
    <div
      className="rounded-[var(--radius-tile)] p-[var(--space-6)] border flex flex-col gap-[var(--space-4)]"
      style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
    >
      <h2 className="ts-xl font-semibold">System Health &amp; Node Status (Admin Only)</h2>
      <p className="ts-sm" style={{ color: "var(--color-text-muted)" }}>
        Real-time telemetry, ESP32 zone-node connectivity status, and manual actuator overrides.
      </p>
    </div>
  );
}
