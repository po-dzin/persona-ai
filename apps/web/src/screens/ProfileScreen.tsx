import { useState } from "react";

interface ProfileScreenProps {
  credits: number;
  generations: number;
  firstName?: string;
  username?: string;
  avatarUrl?: string;
  onOpenPrivacyPolicy?: () => void;
  onOpenTermsOfService?: () => void;
  onOpenPaymentsPolicy?: () => void;
  onOpenDisclaimer?: () => void;
}

function _initials(name?: string): string {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function ProfileScreen({
  credits,
  generations,
  firstName,
  username,
  avatarUrl,
  onOpenPrivacyPolicy,
  onOpenTermsOfService,
  onOpenPaymentsPolicy,
  onOpenDisclaimer,
}: ProfileScreenProps) {
  const displayName = firstName || username || "Пользователь";
  const displayUsername = username ? `@${username}` : null;
  const [legalOpen, setLegalOpen] = useState(false);

  return (
    <section className="screen profile-screen">
      <div className="profile-header">
        <div className="profile-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} className="profile-avatar-image" />
            : _initials(displayName)
          }
        </div>
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
      </div>

      <div className="profile-section-title">Мы в соцсетях</div>
      <div className="profile-card">
        <div className="profile-row">
          <div className="profile-row-icon profile-row-icon-instagram">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Instagram</div>
            <div className="profile-row-desc">Вдохновение и идеи</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="profile-row">
          <div className="profile-row-icon profile-row-icon-telegram">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="var(--sem-color-info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Telegram канал</div>
            <div className="profile-row-desc">Новости и обновления</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <div className="profile-section-title">Помощь</div>
      <div className="profile-card">
        <div className="profile-row">
          <div className="profile-row-icon profile-row-icon-support">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="var(--sem-color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="profile-row-text">
            <div className="profile-row-label">Поддержка</div>
            <div className="profile-row-desc">Написать нам</div>
          </div>
          <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <button
        className="profile-collapse-header"
        type="button"
        onClick={() => setLegalOpen((prev) => !prev)}
        aria-expanded={legalOpen}
      >
        <div className="profile-section-title-inline">Условия и политика</div>
        <svg className={`profile-collapse-arrow${legalOpen ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {legalOpen ? (
        <div className="profile-card">
          <button className="profile-row profile-row-button" type="button" onClick={onOpenPrivacyPolicy}>
            <div className="profile-row-icon profile-row-icon-doc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="profile-row-text">
              <div className="profile-row-label">Политика конфиденциальности</div>
              <div className="profile-row-desc">Privacy Policy</div>
            </div>
            <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="profile-row profile-row-button" type="button" onClick={onOpenTermsOfService}>
            <div className="profile-row-icon profile-row-icon-doc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="profile-row-text">
              <div className="profile-row-label">Пользовательское соглашение</div>
              <div className="profile-row-desc">Terms of Service</div>
            </div>
            <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="profile-row profile-row-button" type="button" onClick={onOpenPaymentsPolicy}>
            <div className="profile-row-icon profile-row-icon-doc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="profile-row-text">
              <div className="profile-row-label">Политика обработки платежей</div>
            </div>
            <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="profile-row profile-row-button" type="button" onClick={onOpenDisclaimer}>
            <div className="profile-row-icon profile-row-icon-doc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="profile-row-text">
              <div className="profile-row-label">Отказ от ответственности</div>
              <div className="profile-row-desc">Disclaimer</div>
            </div>
            <svg className="profile-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ) : null}

      <div className="screen-tail-space" />
    </section>
  );
}
