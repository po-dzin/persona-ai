import { useState } from "react";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Revenue from "./pages/Revenue";
import Generations from "./pages/Generations";
import Users from "./pages/Users";

export type Page = "dashboard" | "revenue" | "generations" | "users";

function hasTgInitData(): boolean {
  const params = new URLSearchParams(window.location.search);
  return !!(params.get("tgInitData") || sessionStorage.getItem("admin_tg_init_data"));
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") ?? "");
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
