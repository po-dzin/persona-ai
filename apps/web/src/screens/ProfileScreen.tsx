interface ProfileScreenProps {
  credits: number;
  generations: number;
}

export function ProfileScreen({ credits, generations }: ProfileScreenProps) {
  return (
    <section className="screen">
      <div className="top-bar"><div className="top-bar-title">Профиль</div></div>

      <div className="profile-header">
        <div className="profile-avatar">AV</div>
        <div className="profile-name">Anna Volkova</div>
        <div className="profile-username">@anna_volkova</div>
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat-value">{generations}</div>
          <div className="profile-stat-label">Генераций</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{credits}</div>
          <div className="profile-stat-label">Монет</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">0</div>
          <div className="profile-stat-label">Рефералов</div>
        </div>
      </div>

      <div className="profile-section-title">Настройки</div>
      <div className="profile-card">
        <div className="profile-row">
          <div className="profile-row-icon" style={{ background: "rgba(167,139,250,0.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="#A78BFA" strokeWidth="1.8"/>
              <path d="M20 21a8 8 0 0 0-16 0" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Аккаунт</div>
            <div className="profile-row-desc">Управление профилем</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="profile-row">
          <div className="profile-row-icon" style={{ background: "rgba(74,222,128,0.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M17 20h4v-2a4 4 0 0 0-3-3.87M9 20H5v-2a4 4 0 0 1 3-3.87m6 5.87v-2a4 4 0 0 0-2-3.46M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Партнёрская программа</div>
            <div className="profile-row-desc">Приглашай друзей и зарабатывай</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="profile-row">
          <div className="profile-row-icon" style={{ background: "rgba(255,214,102,0.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" stroke="#FFD666" strokeWidth="1.8"/>
              <path d="M14.8 9a2 2 0 0 0-1.8-1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-1.8-1" stroke="#FFD666" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M12 7v2m0 6v2" stroke="#FFD666" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Баланс</div>
            <div className="profile-row-desc">{credits} монет</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <div style={{ height: 20 }} />
    </section>
  );
}
