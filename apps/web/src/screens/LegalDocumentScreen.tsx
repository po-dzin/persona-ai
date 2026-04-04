interface LegalSection {
  heading?: string;
  paragraphs: string[];
}

interface LegalDocumentScreenProps {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
  onBack: () => void;
}

export function LegalDocumentScreen({ title, updatedAt, sections, onBack }: LegalDocumentScreenProps) {
  return (
    <section className="screen legal-screen">
      <div className="legal-header">
        <button type="button" className="legal-back" onClick={onBack} aria-label="Назад">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="legal-title">{title}</h1>
      </div>

      <div className="legal-card">
        <div className="legal-updated">Обновлено: {updatedAt}</div>
        {sections.map((section, sectionIndex) => (
          <div key={`${section.heading ?? "section"}-${sectionIndex}`} className="legal-section">
            {section.heading ? <h2 className="legal-section-heading">{section.heading}</h2> : null}
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={`paragraph-${sectionIndex}-${paragraphIndex}`} className="legal-paragraph">{paragraph}</p>
            ))}
          </div>
        ))}
      </div>

      <div className="screen-tail-space" />
    </section>
  );
}
