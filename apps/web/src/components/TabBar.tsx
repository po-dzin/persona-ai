import type { BaseScreen } from "../../../../shared/contracts/ui";

interface TabBarProps {
  activeScreen: BaseScreen;
  isCreateActive: boolean;
  photosBadge: number;
  onChange: (screen: BaseScreen) => void;
  onOpenCreate: () => void;
}

export function TabBar({ activeScreen, isCreateActive, photosBadge, onChange, onOpenCreate }: TabBarProps) {
  const screen = (s: BaseScreen) => (isCreateActive ? "" : activeScreen === s ? "active" : "");

  return (
    <div className="tab-bar">
      <button className={`tab-item ${screen("home")}`} onClick={() => onChange("home")} aria-label="Главная">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button className={`tab-item ${screen("photos")}`} onClick={() => onChange("photos")} aria-label="Мои фото">
        <div className="tab-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8"/>
          </svg>
          {photosBadge > 0 ? <span className="tab-badge">{photosBadge}</span> : null}
        </div>
      </button>

      <button className={`tab-ai${isCreateActive ? " active" : ""}`} onClick={onOpenCreate} aria-label="Создать">
        <svg className="tab-ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11.5 20h-6.5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2 1 1 0 0 1 1-1h6a1 1 0 0 1 1 1 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v3"/>
          <path d="M9 13a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/>
          <path d="M19 22.5a4.75 4.75 0 0 1 3.5-3.5 4.75 4.75 0 0 1-3.5-3.5 4.75 4.75 0 0 1-3.5 3.5 4.75 4.75 0 0 1 3.5 3.5"/>
        </svg>
      </button>

      <button className={`tab-item ${screen("balance")}`} onClick={() => onChange("balance")} aria-label="Баланс">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M14.8 9a2 2 0 0 0-1.8-1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-1.8-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 7v2m0 6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>

      <button className={`tab-item ${screen("profile")}`} onClick={() => onChange("profile")} aria-label="Профиль">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
