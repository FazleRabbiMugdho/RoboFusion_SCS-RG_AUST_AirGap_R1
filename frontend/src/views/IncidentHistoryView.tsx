export function IncidentHistoryView() {
  return (
    <div
      className="rounded-[var(--radius-tile)] p-[var(--space-6)] border"
      style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
    >
      <h2 className="ts-xl font-semibold mb-[var(--space-2)]">Incident History Log</h2>
      <p className="ts-sm" style={{ color: "var(--color-text-muted)" }}>
        Filterable incident timeline showing SAFE → WARNING → CRITICAL state transitions and staff acknowledgments.
      </p>
    </div>
  );
}
