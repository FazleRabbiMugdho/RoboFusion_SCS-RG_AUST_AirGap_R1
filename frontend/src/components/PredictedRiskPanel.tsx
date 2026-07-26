import { BrainCircuit } from "lucide-react";
import type { ZoneHealthData } from "../views/SystemHealthView";

const PANEL_MODEL_READY = false;

function BarPlaceholder({ zoneName }: { zoneName: string }) {
  return (
    <div
      className="grid items-center gap-3 rounded-[var(--radius-tile)] p-[var(--space-3)]"
      style={{
        gridTemplateColumns: "1fr 3fr",
        border: "2px dashed var(--color-forecast-accent)",
        background: "rgba(30, 41, 59, 0.4)",
      }}
    >
      <span className="ts-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
        {zoneName}
      </span>
      <div
        className="rounded-[var(--radius-control)] h-5 flex items-center justify-start overflow-hidden"
        style={{
          background: "rgba(99, 102, 241, 0.08)",
          border: "1px solid rgba(99, 102, 241, 0.15)",
        }}
      >
        <div
          className="h-full rounded-[var(--radius-control)]"
          style={{
            width: 0,
            background: "var(--color-forecast-accent)",
            transition: "width 400ms ease",
          }}
        />
      </div>
      <span />
      <span className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
        Model not yet trained
      </span>
    </div>
  );
}

interface Props {
  zones: ZoneHealthData[];
}

export function PredictedRiskPanel({ zones }: Props) {
  return (
    <div
      className="flex flex-col rounded-[var(--radius-tile)] overflow-hidden"
      style={{
        background: "rgba(15, 23, 42, 0.5)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
      }}
    >
      <div
        className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b"
        style={{ borderColor: "rgba(99, 102, 241, 0.15)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid place-items-center rounded-[var(--radius-control)]"
            style={{
              width: 28,
              height: 28,
              background: "rgba(99, 102, 241, 0.12)",
            }}
          >
            <BrainCircuit size={16} color="var(--color-forecast-accent)" />
          </div>
          <div>
            <h3 className="ts-sm font-semibold" style={{ color: "var(--color-forecast-accent)" }}>
              Predicted Risk
            </h3>
            <p className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
              Predicted &mdash; not live
            </p>
          </div>
        </div>
        <span
          className="ts-xs uppercase tracking-wider font-semibold"
          style={{ color: "var(--color-forecast-accent)", letterSpacing: "0.08em" }}
        >
          AI FORECAST
        </span>
      </div>

      <div className="flex flex-col gap-[var(--space-2)] p-[var(--space-4)]">
        {zones.map((z) => (
          <BarPlaceholder key={z.id} zoneName={z.name} />
        ))}
      </div>
    </div>
  );
}
