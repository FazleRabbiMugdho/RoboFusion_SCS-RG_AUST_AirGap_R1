import { useState, useRef, useEffect } from "react";
import { X, Send, AlertTriangle, CheckCircle, Loader2, Info, XCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onReportSuccess?: () => void;
}

export function NLIncidentReportModal({ isOpen, onClose, token, onReportSuccess }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error" | "unavailable">("idle");
  const [result, setResult] = useState<{
    zone_name: string;
    hazard_type: string;
    severity: number;
    zone_state: string;
    risk_score: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_LENGTH = 500;

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || status === "submitting") return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/v1/incidents/report-nl", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ free_text: text.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setResult({
          zone_name: data.zone_name,
          hazard_type: data.hazard_type,
          severity: data.severity,
          zone_state: data.zone_state,
          risk_score: data.risk_score,
        });
        onReportSuccess?.();
      } else if (res.status === 422) {
        setStatus("error");
        setErrorMessage("couldn't confidently parse that report — please use the standard incident form");
      } else if (res.status === 503) {
        setStatus("unavailable");
        setErrorMessage("NL reporting is temporarily unavailable — please use the standard incident form");
      } else {
        setStatus("error");
        setErrorMessage("An unexpected error occurred");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error — please try again");
    }
  };

  const handleClose = () => {
    setText("");
    setStatus("idle");
    setResult(null);
    setErrorMessage("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade-up">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md rounded-[var(--radius-tile)] border-2 overflow-hidden anim-scale-in"
        style={{
          background: "rgba(15, 23, 42, 0.95)",
          borderColor: "var(--color-surface-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b"
          style={{ borderColor: "var(--color-surface-border)" }}
        >
          <h2 className="ts-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Report Incident
          </h2>
          <button
            onClick={handleClose}
            className="focus-ring btn-lift rounded-[var(--radius-control)] p-[var(--space-2)] cursor-pointer"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-[var(--space-4)] space-y-4">
          {status === "success" && result && (
            <div
              className="rounded-[var(--radius-tile)] p-[var(--space-3)] border anim-fade-up"
              style={{
                background: "rgba(22, 163, 74, 0.12)",
                borderColor: "var(--color-status-safe)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} color="var(--color-status-safe)" />
                <span className="ts-sm font-medium" style={{ color: "var(--color-status-safe)" }}>
                  Report Accepted
                </span>
              </div>
              <div className="space-y-1 ts-xs" style={{ color: "var(--color-text-secondary)" }}>
                <div><strong>Zone:</strong> {result.zone_name}</div>
                <div><strong>Hazard:</strong> {result.hazard_type}</div>
                <div><strong>Severity:</strong> {(result.severity * 100).toFixed(0)}%</div>
                <div><strong>Zone State:</strong> {result.zone_state}</div>
                <div><strong>Risk Score:</strong> {result.risk_score.toFixed(1)}</div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div
              className="rounded-[var(--radius-tile)] p-[var(--space-3)] border anim-fade-up"
              style={{
                background: "rgba(220, 38, 38, 0.12)",
                borderColor: "var(--color-status-critical)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={18} color="var(--color-status-critical)" />
                <span className="ts-sm font-medium" style={{ color: "var(--color-status-critical)" }}>
                  Could Not Parse
                </span>
              </div>
              <p className="ts-xs" style={{ color: "var(--color-text-secondary)" }}>
                {errorMessage}
              </p>
            </div>
          )}

          {status === "unavailable" && (
            <div
              className="rounded-[var(--radius-tile)] p-[var(--space-3)] border anim-fade-up"
              style={{
                background: "rgba(217, 119, 6, 0.12)",
                borderColor: "var(--color-status-warning)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Info size={18} color="var(--color-status-warning)" />
                <span className="ts-sm font-medium" style={{ color: "var(--color-status-warning)" }}>
                  Temporarily Unavailable
                </span>
              </div>
              <p className="ts-xs" style={{ color: "var(--color-text-secondary)" }}>
                {errorMessage}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="incident-text" className="ts-sm font-medium block mb-1">
              Describe the hazard (max {MAX_LENGTH} chars)
            </label>
            <textarea
              ref={textareaRef}
              id="incident-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={4}
              placeholder='e.g., "Strong gas smell in the battery bay near the charging station"'
              className="w-full rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] resize-none border-2"
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                borderColor: "var(--color-surface-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
              disabled={status === "submitting" || status === "success"}
            />
            <div className="flex justify-end mt-1">
              <span
                className="ts-xs"
                style={{
                  color: text.length > MAX_LENGTH * 0.9 ? "var(--color-status-warning)" : "var(--color-text-muted)",
                }}
              >
                {text.length} / {MAX_LENGTH}
              </span>
            </div>
          </div>

          {/* Help text */}
          <p className="ts-xs" style={{ color: "var(--color-text-muted)" }}>
            Mention the zone name and what you observe (fire, gas, water). Reports are parsed by AI
            and validated against live sensor data before being logged.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-[var(--space-2)] pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="focus-ring btn-lift ts-sm rounded-[var(--radius-control)] px-[var(--space-4)] py-[var(--space-2)] border font-medium cursor-pointer"
              style={{
                borderColor: "var(--color-surface-border)",
                color: "var(--color-text-primary)",
              }}
              disabled={status === "submitting"}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="focus-ring btn-lift ts-sm rounded-[var(--radius-control)] px-[var(--space-4)] py-[var(--space-2)] font-medium cursor-pointer disabled:opacity-50"
              style={{
                background: "var(--color-forecast-accent)",
                color: "var(--color-status-onstatus)",
              }}
              disabled={status === "submitting" || status === "success" || !text.trim()}
            >
              {status === "submitting" && <Loader2 size={14} className="animate-spin mr-1" />}
              {status === "success" ? "Done" : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}