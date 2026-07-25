import { CheckCircle2, Users, Clock, Flame, Wind, Droplet } from "lucide-react";
import { STATUS_META, type Status } from "./status";

const CARD_MIN_H = 128; // px — real card min height, matched by skeleton so the rail never jumps

type QueueZone = {
  id: string;
  rank: number;
  name: string;
  status: Status;
  risk: number;
  occupancy: number;
  elapsed: string;
};

const QUEUE: QueueZone[] = [
  { id: "z2", rank: 1, name: "Lab B — Battery Bay", status: "critical", risk: 92, occupancy: 4, elapsed: "00:03:12" },
  { id: "z3", rank: 2, name: "Lab C — Cleanroom", status: "warning", risk: 58, occupancy: 2, elapsed: "00:11:47" },
  { id: "z5", rank: 3, name: "Lab E — Testing", status: "warning", risk: 41, occupancy: 1, elapsed: "00:26:05" },
];

function CardShell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="rounded-[var(--radius-tile)] p-[var(--space-4)] border-2 flex flex-col gap-[var(--space-3)]"
      style={{ minHeight: CARD_MIN_H, background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", ...style }}
    >
      {children}
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Clock; value: string; label: string }) {
  return (
    <div className="flex items-center gap-[var(--space-1)]" title={label}>
      <Icon size={14} style={{ color: "var(--color-text-muted)" }} />
      <span className="ts-sm ts-num">{value}</span>
    </div>
  );
}

function RankedCard({ z, expanded, acknowledged }: { z: QueueZone; expanded?: boolean; acknowledged?: boolean }) {
  const meta = STATUS_META[z.status];
  const Icon = meta.icon;
  return (
    <CardShell style={{ borderColor: acknowledged ? "var(--color-acknowledged)" : meta.token }}>
      <div className="flex items-center gap-[var(--space-2)]">
        <span className="ts-sm ts-num font-semibold" style={{ color: "var(--color-text-muted)" }}>#{z.rank}</span>
        <span className="ts-base font-medium flex-1 truncate">{z.name}</span>
        <Icon size={16} color={acknowledged ? "var(--color-acknowledged)" : meta.token} />
      </div>

      <div className="flex items-center gap-[var(--space-4)]">
        <div className="flex flex-col">
          <span className="ts-2xl ts-num font-semibold" style={{ color: acknowledged ? "var(--color-acknowledged)" : meta.token }}>{z.risk}</span>
          <span className="ts-xs" style={{ color: "var(--color-text-muted)" }}>risk score</span>
        </div>
        <div className="flex flex-col gap-[var(--space-1)]">
          <Metric icon={Users} value={`${z.occupancy}`} label="Occupancy" />
          <Metric icon={Clock} value={z.elapsed} label="Elapsed time-critical" />
        </div>
      </div>

      {/* expanded hover state: risk-breakdown row */}
      {expanded && (
        <div className="grid grid-cols-4 gap-[var(--space-2)] pt-[var(--space-3)] border-t" style={{ borderColor: "var(--color-surface-border)" }}>
          {[
            { icon: Flame, label: "Fire", val: 48 },
            { icon: Wind, label: "Gas", val: 28 },
            { icon: Droplet, label: "Water", val: 6 },
            { icon: Users, label: "Occ.", val: 10 },
          ].map((b) => {
            const BIcon = b.icon;
            return (
              <div key={b.label} className="flex flex-col items-center gap-[var(--space-1)]">
                <BIcon size={13} style={{ color: "var(--color-text-muted)" }} />
                <span className="ts-xs ts-num">+{b.val}</span>
              </div>
            );
          })}
        </div>
      )}

      {acknowledged ? (
        <span className="ts-sm" style={{ color: "var(--color-acknowledged)" }}>Acknowledged by J. Rivera</span>
      ) : (
        <button className="focus-ring ts-sm rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-1)] self-start cursor-pointer" style={{ background: meta.token, color: "var(--color-status-onstatus)" }}>
          Acknowledge
        </button>
      )}
    </CardShell>
  );
}

/* ─── 1. Idle / Loading ─────────────────────────────────────── */
export function QueueLoading() {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {[0, 1].map((i) => (
        <CardShell key={i}>
          <div className="h-5 w-3/4 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
          <div className="h-9 w-20 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
          <div className="h-6 w-24 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-border)" }} />
        </CardShell>
      ))}
    </div>
  );
}

/* ─── 2. All-Nominal ────────────────────────────────────────── */
export function QueueNominal() {
  return (
    <CardShell style={{ borderColor: "var(--color-status-safe)" }}>
      <div className="flex flex-col items-center justify-center text-center gap-[var(--space-2)] py-[var(--space-4)]">
        <CheckCircle2 size={28} color="var(--color-status-safe)" />
        <span className="ts-base font-medium">All zones nominal</span>
        <span className="ts-xs ts-num" style={{ color: "var(--color-text-muted)" }}>last change 00:14:32 ago</span>
      </div>
    </CardShell>
  );
}

/* ─── 3. Populated (one card expanded to show hover state) ──── */
export function QueuePopulated() {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {QUEUE.map((z, i) => (
        <RankedCard key={z.id} z={z} expanded={i === 0} />
      ))}
    </div>
  );
}

/* ─── 4. Acknowledged card ──────────────────────────────────── */
export function QueueAcknowledged() {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <RankedCard z={QUEUE[0]} acknowledged />
      <RankedCard z={QUEUE[1]} />
    </div>
  );
}
