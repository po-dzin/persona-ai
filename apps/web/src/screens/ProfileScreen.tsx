import { useState } from "react";

interface ProfileScreenProps {
  credits: number;
  generations: number;
  referrals: number;
  firstName?: string;
  username?: string;
}

function _initials(name?: string): string {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function ProfileScreen({ credits, generations, referrals, firstName, username }: ProfileScreenProps) {
  const [copied, setCopied] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const displayName = firstName || username || "Пользователь";
  const displayUsername = username ? `@${username}` : null;
  const referralLink = username ? `persona.app/ref/${username}` : "persona.app/ref/—";

  const handleCopy = async () => {
    if (!username) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable in some environments.
    }
  };

  return (
    <section className="screen">
      <div className="profile-header">
        <div className="profile-avatar">{_initials(displayName)}</div>
        <div className="profile-name">{displayName}</div>
        {displayUsername ? <div className="profile-username">{displayUsername}</div> : null}
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
          <div className="profile-stat-value">{referrals}</div>
          <div className="profile-stat-label">Рефералов</div>
        </div>
      </div>

      <button className="partner-collapse-header" onClick={() => setPartnerOpen((v) => !v)}>
        <span className="profile-section-title-inline">Партнёрская программа</span>
        <svg
          className={"partner-collapse-arrow" + (partnerOpen ? " open" : "")}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {partnerOpen && (
        <div className="partner-block">
          <div className="partner-metrics-row">
            <div className="partner-metric">
              <div className="partner-metric-value">—</div>
              <div className="partner-metric-label">Переходы</div>
            </div>
            <div className="partner-metric">
              <div className="partner-metric-value">{referrals}</div>
              <div className="partner-metric-label">Оплат</div>
            </div>
            <div className="partner-metric">
              <div className="partner-metric-value green">$0.00</div>
              <div className="partner-metric-label">Заработано</div>
            </div>
          </div>

          <div className="partner-link-row">
            <div className="partner-link-text">{referralLink}</div>
            <button className="partner-copy-btn" onClick={handleCopy} disabled={!username}>
              {copied ? "Готово!" : "Копировать"}
            </button>
          </div>

          <div className="partner-tier-row">
            <div className="partner-tier-label">Бонус с покупок</div>
            <div className="partner-tier-value">10%</div>
          </div>
          <div className="partner-progress">
            <div className="partner-progress-bar" style={{ width: `${Math.min(referrals * 10, 100)}%` }} />
          </div>
          <div className="partner-tier-hint">Партнёрская программа — скоро</div>
        </div>
      )}

      <div className="profile-section-title">Мы в соцсетях</div>
      <div className="profile-card">
        <div className="profile-row">
          <div className="profile-row-icon" style={{ background: "rgba(225,48,108,0.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2"/>
              <circle cx="12" cy="12" r="5" stroke="#E1306C" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Instagram</div>
            <div className="profile-row-desc">Вдохновение и идеи</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="profile-row">
          <div className="profile-row-icon" style={{ background: "rgba(56,136,255,0.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#3888FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Telegram канал</div>
            <div className="profile-row-desc">Новости и обновления</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <div className="profile-section-title">Помощь</div>
      <div className="profile-card">
        <div className="profile-row">
          <div className="profile-row-icon" style={{ background: "rgba(255,255,255,0.05)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Поддержка</div>
            <div className="profile-row-desc">Написать нам</div>
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
