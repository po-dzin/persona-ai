import type { ReactNode } from "react";
import type { Page } from "../App";

interface NavItem { id: Page; label: string; icon: string; }

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "revenue", label: "Revenue", icon: "💰" },
  { id: "generations", label: "Генерации", icon: "🖼️" },
  { id: "users", label: "Пользователи", icon: "👥" },
];

interface Props {
  page: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({ page, onNavigate, onLogout, children }: Props) {
  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100dvh",
      }}>
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>⚙️ Persona</div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>Admin Panel</div>
        </div>

        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 12px", borderRadius: 8, border: "none", textAlign: "left",
                background: page === item.id ? "var(--accent-dim)" : "transparent",
                color: page === item.id ? "var(--accent)" : "var(--text)",
                fontWeight: page === item.id ? 600 : 400,
                marginBottom: 2, transition: "background .15s",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onLogout}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "9px 12px", borderRadius: 8, border: "none", textAlign: "left",
              background: "transparent", color: "var(--muted)",
            }}
          >
            <span>🚪</span> Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "auto", padding: 28 }}>
        {children}
      </main>
    </div>
  );
}
