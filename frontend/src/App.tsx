import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./lib/api";
import type { LoginUser } from "./types";
import DailyCheckIn from "./pages/DailyCheckIn";
import Login from "./pages/Login";
import MyStreaks from "./pages/MyStreaks";
import Settings from "./pages/Settings";
import Shell from "./components/Shell";

type AuthState = "loading" | "signed-in" | "signed-out" | "error";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<LoginUser | null>(null);
  const [authError, setAuthError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api<{ user: LoginUser | null }>("/auth/me/")
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        setAuthState(currentUser ? "signed-in" : "signed-out");
      })
      .catch((error: Error) => {
        setAuthError(error.message || "Could not connect to the DayBloom server.");
        setAuthState("error");
      });
  }, []);

  async function onLogin(nextUser: LoginUser) {
    setUser(nextUser);
    setAuthState("signed-in");
    navigate("/daily-checkin", { replace: true });
  }

  async function onLogout() {
    try {
      await api<void>("/auth/logout/", { method: "POST" });
      setUser(null);
      setAuthState("signed-out");
      navigate("/login", { replace: true });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "You could not be signed out.");
      setAuthState("error");
    }
  }

  if (authState === "loading") {
    return <main className="startup-state"><span className="spinner" />Opening your garden…</main>;
  }
  if (authState === "error") {
    return (
      <main className="startup-state">
        <div className="error-card">
          <h1>DayBloom is taking a little rest</h1>
          <p>{authError}</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }
  if (authState === "signed-out") {
    if (location.pathname !== "/login") return <Navigate to="/login" replace />;
    return <Login onLogin={onLogin} />;
  }

  return (
    <Routes>
      <Route element={<Shell user={user!} onLogout={onLogout} />}>
        <Route path="/" element={<Navigate to="/daily-checkin" replace />} />
        <Route path="/daily-checkin" element={<DailyCheckIn />} />
        <Route path="/streaks" element={<MyStreaks />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/daily-checkin" replace />} />
      </Route>
      <Route path="/login" element={<Navigate to="/daily-checkin" replace />} />
    </Routes>
  );
}
