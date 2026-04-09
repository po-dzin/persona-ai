import { useState } from "react";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Revenue from "./pages/Revenue";
import Generations from "./pages/Generations";
import Users from "./pages/Users";

export type Page = "dashboard" | "revenue" | "generations" | "users";

function hasTgInitData(): boolean {
  // Read tgInitData from URL hash fragment only (not query string) —
  // hash is never sent to the server and not stored in browser history.
  const hash = window.location.hash.slice(1);
  const fromHash = new URLSearchParams(hash).get("tgInitData") ?? "";
  if (fromHash) {
    sessionStorage.setItem("admin_tg_init_data", fromHash);
    // Clean the hash so credentials aren't visible in the URL bar
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
  }
  return !!(fromHash || sessionStorage.getItem("admin_tg_init_data"));
}

/** Support ?token=xxx URL param for local dev convenience */
function getTokenFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("token") ?? "";
  if (t) {
    localStorage.setItem("admin_token", t);
    // Remove token from URL so it's not visible in browser history
    const clean = new URL(window.location.href);
    clean.searchParams.delete("token");
    window.history.replaceState({}, "", clean.toString());
  }
  return t;
}

export default function App() {
  const [token, setToken] = useState(() => getTokenFromUrl() || localStorage.getItem("admin_token") || "");
  const [page, setPage] = useState<Page>("dashboard");

  // If TG init data is present (opened from mini-app), skip login screen
  const authenticated = hasTgInitData() || !!token;

  if (!authenticated) {
    return <Login onLogin={(t) => { localStorage.setItem("admin_token", t); setToken(t); }} />;
  }

  const logout = () => {
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_tg_init_data");
    setToken("");
    // Navigate to /admin without tgInitData query param so hasTgInitData()
    // returns false and the login screen is shown instead of auto re-auth.
    window.location.replace("/admin/");
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Перейти к содержимому</a>
      <Layout page={page} onNavigate={setPage} onLogout={logout}>
        <div id="main-content">
          {page === "dashboard" && <Dashboard />}
          {page === "revenue" && <Revenue />}
          {page === "generations" && <Generations />}
          {page === "users" && <Users />}
        </div>
      </Layout>
    </>
  );
}
