import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Revenue from "./pages/Revenue";
import Generations from "./pages/Generations";
import Users from "./pages/Users";
import Lifecycle from "./pages/Lifecycle";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready?(): void;
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
        viewportStableHeight?: number;
        onEvent?(event: string, cb: () => void): void;
      };
    };
  }
}

export type Page = "dashboard" | "revenue" | "generations" | "users" | "lifecycle";

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

function useTgSafeTop() {
  useEffect(() => {
    const applyInset = () => {
      const tg = window.Telegram?.WebApp;
      const root = document.documentElement;
      const safeTop = tg?.safeAreaInset?.top ?? 0;
      const contentSafeTop = tg?.contentSafeAreaInset?.top ?? 0;
      const tgChromeTop = safeTop + contentSafeTop;
      const stableH = typeof tg?.viewportStableHeight === "number" ? tg.viewportStableHeight : undefined;
      const stableGapTop = typeof stableH === "number" ? Math.max(0, window.innerHeight - stableH) : 0;
      const inset = tg ? Math.max(tgChromeTop, stableGapTop) : 0;
      root.style.setProperty("--safe-top", inset > 0 ? `${inset}px` : "env(safe-area-inset-top, 0px)");
    };

    applyInset();
    const t1 = setTimeout(applyInset, 150);
    const t2 = setTimeout(applyInset, 600);
    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.("viewportChanged", applyInset);
    tg?.onEvent?.("safeAreaChanged", applyInset);
    tg?.onEvent?.("contentSafeAreaChanged", applyInset);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
}

export default function App() {
  useTgSafeTop();
  const [token, setToken] = useState(() => getTokenFromUrl() || localStorage.getItem("admin_token") || "");
  const [page, setPage] = useState<Page>("dashboard");

  // If TG init data is present (opened from mini-app), skip login screen
  const authenticated = hasTgInitData() || !!token;

  if (!authenticated) {
    return <Login onLogin={(t) => { localStorage.setItem("admin_token", t); setToken(t); }} />;
  }

  const returnToApp = () => {
    window.location.assign("/");
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Перейти к содержимому</a>
      <Layout page={page} onNavigate={setPage} onReturnToApp={returnToApp}>
        <div id="main-content">
          {page === "dashboard" && <Dashboard />}
          {page === "revenue" && <Revenue />}
          {page === "generations" && <Generations />}
          {page === "users" && <Users />}
          {page === "lifecycle" && <Lifecycle />}
        </div>
      </Layout>
    </>
  );
}
