interface BottomSheetOption {
  id: string;
  label: string;
  sublabel?: string;
  selected?: boolean;
}

interface BottomSheetProps {
  isOpen: boolean;
  title?: string;
  options: BottomSheetOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function BottomSheet({ isOpen, title, options, onSelect, onClose }: BottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet-handle" aria-hidden="true" />
        {title ? <div className="sheet-title">{title}</div> : null}
        <div className="sheet-options">
          {options.map((opt) => (
            <button
              key={opt.id}
              className={"sheet-option" + (opt.selected ? " selected" : "")}
              onClick={() => { onSelect(opt.id); onClose(); }}
              aria-pressed={opt.selected}
            >
              <div className="sheet-option-left">
                <div className="sheet-option-label">{opt.label}</div>
                {opt.sublabel ? <div className="sheet-option-sublabel">{opt.sublabel}</div> : null}
              </div>
              {opt.selected ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
