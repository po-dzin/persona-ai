import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Page } from "../App";
import {
  IconDashboard,
  IconRevenue,
  IconGenerations,
  IconUsers,
  IconLifecycle,
  IconLogout,
  IconMenu,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
} from "./Icons";

interface NavItem {
  id: Page;
  label: string;
  Icon: React.FC<{ size?: number }>;
}

const NAV: NavItem[] = [
  { id: "dashboard",   label: "Дашборд",         Icon: IconDashboard },
  { id: "revenue",     label: "Выручка",         Icon: IconRevenue },
  { id: "generations", label: "Генерации",       Icon: IconGenerations },
  { id: "users",       label: "Пользователи",    Icon: IconUsers },
  { id: "lifecycle",   label: "Жизненный цикл",  Icon: IconLifecycle },
];

/** On tablet (640–1023px) start collapsed (rail), desktop starts expanded. */
function initCollapsed() {
  const w = window.innerWidth;
  return w >= 640 && w < 1024;
}

interface Props {
  page: Page;
  onNavigate: (p: Page) => void;
  onReturnToApp: () => void;
  children: ReactNode;
}

export default function Layout({ page, onNavigate, onReturnToApp, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initCollapsed);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [page]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleNav = (id: Page) => { onNavigate(id); setMobileOpen(false); };

  const sidebarClass = [
    "sidebar",
    mobileOpen  ? "sidebar--open"      : "",
    collapsed   ? "sidebar--collapsed" : "",
  ].filter(Boolean).join(" ");

  const layoutClass = ["layout", collapsed ? "layout--collapsed" : ""].filter(Boolean).join(" ");

  return (
    <div className={layoutClass}>
      {/* Mobile top bar */}
      <header className="topbar">
        <button className="topbar-burger" onClick={() => setMobileOpen((v) => !v)} aria-label="Меню">
          {mobileOpen ? <IconClose /> : <IconMenu />}
        </button>
        <div className="topbar-title">
          Persona <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400, marginLeft: 4 }}>Админка</span>
        </div>
      </header>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={sidebarClass}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">Persona</span>
          <span className="sidebar-logo-sub">Админка</span>
          {/* Collapse toggle — desktop/tablet only */}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Развернуть" : "Свернуть"}
            aria-label={collapsed ? "Развернуть боковую панель" : "Свернуть боковую панель"}
          >
            {collapsed ? <IconChevronRight size={15} /> : <IconChevronLeft size={15} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item${page === id ? " nav-item--active" : ""}`}
              onClick={() => handleNav(id)}
              title={label}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
            >
              <span className="nav-item-icon"><Icon size={18} /></span>
              <span className="nav-item-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item nav-item--logout" onClick={onReturnToApp} title="Вернуться в приложение" aria-label="Вернуться в приложение">
            <span className="nav-item-icon"><IconLogout size={18} /></span>
            <span className="nav-item-label">В приложение</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="layout-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
