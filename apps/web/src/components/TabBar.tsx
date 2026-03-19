import type { BaseScreen } from "../hooks/useScreen";

interface TabBarProps {
  activeScreen: BaseScreen;
  photosBadge: number;
  onChange: (screen: BaseScreen) => void;
  onOpenCreate: () => void;
}

export function TabBar({ activeScreen, photosBadge, onChange, onOpenCreate }: TabBarProps) {
  return (
    <div className="tab-bar">
      <button className={`tab-item ${activeScreen === "home" ? "active" : ""}`} onClick={() => onChange("home")}>Главная</button>
      <button className={`tab-item ${activeScreen === "photos" ? "active" : ""}`} onClick={() => onChange("photos")}>
        Мои фото
        {photosBadge > 0 ? <span className="tab-badge">{photosBadge}</span> : null}
      </button>
      <button className="tab-ai" onClick={onOpenCreate}>
        ✨ AI
      </button>
      <button className={`tab-item ${activeScreen === "balance" ? "active" : ""}`} onClick={() => onChange("balance")}>Баланс</button>
      <button className={`tab-item ${activeScreen === "profile" ? "active" : ""}`} onClick={() => onChange("profile")}>Профиль</button>
    </div>
  );
}
