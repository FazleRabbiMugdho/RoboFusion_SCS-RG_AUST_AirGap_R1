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
      className="h-full w-full grid place-items-center p-[var(--space-4)] login-bg"
      style={{ color: "var(--color-text-primary)" }}
    >
      {/* Floating particles effect (pure CSS) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: 300,
            height: 300,
            top: "10%",
            left: "15%",
            background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: 400,
            height: 400,
            bottom: "5%",
            right: "10%",
            background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)",
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: 200,
            height: 200,
            top: "50%",
            right: "30%",
            background: "radial-gradient(circle, rgba(220,38,38,0.04) 0%, transparent 70%)",
            animationDelay: "0.5s",
          }}
        />
      </div>

      <div
        className="login-card relative w-full max-w-md rounded-[var(--radius-tile)] p-[var(--space-8)] border flex flex-col gap-[var(--space-6)]"
        style={{
          background: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(20px) saturate(160%)",
          borderColor: "rgba(148, 163, 184, 0.12)",
        }}
      >
        <div className="flex flex-col items-center gap-[var(--space-2)] text-center">
          <div
            className="rounded-[var(--radius-control)] grid place-items-center mb-[var(--space-2)]"
            style={{
              width: 52,
              height: 52,
              background: "linear-gradient(135deg, var(--color-status-critical), #ef4444)",
              boxShadow: "0 4px 20px rgba(220, 38, 38, 0.35)",
            }}
          >
            <ShieldCheck size={28} color="var(--color-status-onstatus)" />
          </div>
          <h1
            className="ts-2xl font-bold"
            style={{
              background: "linear-gradient(135deg, #FFFFFF 0%, #94A3B8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            RoboFusion 1.0
          </h1>
          <p className="ts-sm" style={{ color: "var(--color-text-muted)" }}>
            Smart Campus Safety &amp; Response Grid
          </p>
        </div>

        {errorMsg && (
          <div
            className="ts-sm flex items-center gap-[var(--space-2)] rounded-[var(--radius-control)] p-[var(--space-3)] border anim-fade-up"
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
                className="focus-ring w-full rounded-[var(--radius-control)] pl-9 pr-3 py-2.5 border ts-sm outline-none"
                style={{
                  background: "rgba(15, 23, 42, 0.5)",
                  borderColor: "rgba(148, 163, 184, 0.15)",
                  color: "var(--color-text-primary)",
                  transition: "border-color 200ms ease, box-shadow 200ms ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-focus-ring)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(148, 163, 184, 0.15)";
                  e.target.style.boxShadow = "none";
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
                className="focus-ring w-full rounded-[var(--radius-control)] pl-9 pr-10 py-2.5 border ts-sm outline-none"
                style={{
                  background: "rgba(15, 23, 42, 0.5)",
                  borderColor: "rgba(148, 163, 184, 0.15)",
                  color: "var(--color-text-primary)",
                  transition: "border-color 200ms ease, box-shadow 200ms ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-focus-ring)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(148, 163, 184, 0.15)";
                  e.target.style.boxShadow = "none";
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
            className="focus-ring btn-lift ts-sm font-semibold rounded-[var(--radius-control)] py-[var(--space-3)] px-[var(--space-4)] mt-[var(--space-2)] cursor-pointer disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, var(--color-focus-ring), var(--color-forecast-accent))",
              color: "#FFFFFF",
              boxShadow: "0 4px 16px rgba(59, 130, 246, 0.3)",
              transition: "transform 200ms ease, box-shadow 200ms ease, opacity 200ms ease",
            }}
          >
            {loading ? "Authenticating…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
