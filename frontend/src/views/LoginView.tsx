import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, User as UserIcon, AlertOctagon, Eye, EyeOff } from "lucide-react";
import { useAuthStore, type UserRole } from "../store/authStore";

export function LoginView() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setErrorMsg("Invalid username or password. Please try again.");
        } else {
          const errData = await response.json().catch(() => null);
          setErrorMsg(errData?.detail || `Login failed with status ${response.status}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      // backend returns: { access_token, token_type, role }
      const token = data.access_token;
      const role = (data.role?.toUpperCase() || "STAFF") as UserRole;

      login(token, role, username);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login request error:", err);
      setErrorMsg("Network error connecting to auth server. Please verify backend service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="h-full w-full grid place-items-center p-[var(--space-4)]"
      style={{ background: "var(--color-bg-base)", color: "var(--color-text-primary)" }}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-tile)] p-[var(--space-6)] border flex flex-col gap-[var(--space-6)] shadow-2xl"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex flex-col items-center gap-[var(--space-2)] text-center">
          <div
            className="rounded-[var(--radius-control)] grid place-items-center mb-[var(--space-2)]"
            style={{ width: 44, height: 44, background: "var(--color-status-critical)" }}
          >
            <ShieldCheck size={26} color="var(--color-status-onstatus)" />
          </div>
          <h1 className="ts-2xl font-bold">RoboFusion 1.0</h1>
          <p className="ts-sm" style={{ color: "var(--color-text-muted)" }}>
            Smart Campus Safety &amp; Response Grid
          </p>
        </div>

        {errorMsg && (
          <div
            className="ts-sm flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] p-[var(--space-3)] border"
            style={{ background: "rgba(220,38,38,0.15)", borderColor: "var(--color-status-critical)", color: "var(--color-text-primary)" }}
          >
            <AlertOctagon size={18} className="shrink-0" color="var(--color-status-critical)" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
          <div className="flex flex-col gap-[var(--space-1)]">
            <label className="ts-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Username
            </label>
            <div className="relative flex items-center">
              <UserIcon size={16} className="absolute left-3 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="focus-ring w-full rounded-[var(--radius-control)] pl-9 pr-3 py-2 border ts-sm outline-none"
                style={{
                  background: "var(--color-surface-raised)",
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[var(--space-1)]">
            <label className="ts-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Password
            </label>
            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="focus-ring w-full rounded-[var(--radius-control)] pl-9 pr-10 py-2 border ts-sm outline-none"
                style={{
                  background: "var(--color-surface-raised)",
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="focus-ring absolute right-2.5 p-1 rounded hover:opacity-80 cursor-pointer flex items-center justify-center"
                style={{ color: "var(--color-text-muted)" }}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="focus-ring ts-sm font-semibold rounded-[var(--radius-control)] py-[var(--space-2)] px-[var(--space-4)] mt-[var(--space-2)] cursor-pointer transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--color-focus-ring)", color: "#FFFFFF" }}
          >
            {loading ? "Authenticating…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
