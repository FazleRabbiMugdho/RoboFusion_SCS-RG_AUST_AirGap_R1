import { useEffect, useState } from "react";
import { BrainCircuit, AlertTriangle } from "lucide-react";
import type { ZoneHealthData } from "../views/SystemHealthView";
import { useAuthStore } from "../store/authStore";

const PANEL_MODEL_READY = true;

interface PredictedRiskItem {
  zone_id: number;
  zone_name: string;
  fire_norm: number;
  gas_norm: number;
  water_norm: number;
  occupied: boolean;
  critical_probability: number | null;
}

function RiskBar({ zoneName, probability }: { zoneName: string; probability: number | null }) {
  const hasModel = probability !== null;
  const pct = hasModel ? Math.round(probability * 100) : 0;

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
            width: `${pct}%`,
            background: hasModel ? "var(--color-forecast-accent)" : "transparent",
            transition: "width 400ms ease",
          }}
        />
      </div>
      {hasModel ? (
        <span className="ts-xs font-semibold" style={{ color: "var(--color-forecast-accent)" }}>
          {pct}%
        </span>
      ) : (
        <span className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
          Model unavailable
        </span>
      )}
    </div>
  );
}

function LoadingBar({ zoneName }: { zoneName: string }) {
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
          className="h-full rounded-[var(--radius-control)] animate-pulse"
          style={{
            width: "50%",
            background: "var(--color-forecast-accent)",
          }}
        />
      </div>
      <span className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
        Loading...
      </span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2"
      style={{ background: "rgba(220, 38, 38, 0.12)", border: "1px solid var(--color-status-critical)" }}
    >
      <AlertTriangle size={14} color="var(--color-status-critical)" />
      <span className="ts-xs" style={{ color: "var(--color-status-critical)" }}>
        {message}
      </span>
    </div>
  );
}

interface Props {
  zones: ZoneHealthData[];
}

export function PredictedRiskPanel({ zones }: Props) {
  const token = useAuthStore((state) => state.token);
  const [predictions, setPredictions] = useState<PredictedRiskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPredictions() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/admin/zones/predicted-risk", {
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
        });
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setPredictions(data.predictions || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load predictions");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (PANEL_MODEL_READY) {
      fetchPredictions();
    } else {
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!PANEL_MODEL_READY) {
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
            <LoadingBar key={z.id} zoneName={z.name} />
          ))}
        </div>
      </div>
    );
  }

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
        {error && <ErrorBanner message={error} />}
        {isLoading ? (
          zones.map((z) => <LoadingBar key={z.id} zoneName={z.name} />)
        ) : (
          zones.map((z) => {
            const pred = predictions.find((p) => p.zone_id === z.id);
            return <RiskBar key={z.id} zoneName={z.name} probability={pred?.critical_probability ?? null} />;
          })
        )}
      </div>
    </div>
  );
}