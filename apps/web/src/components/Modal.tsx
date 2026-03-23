interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

export function Modal({ isOpen, title, description, meta, actionLabel, onAction, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-icon">✨</div>
        <div className="modal-title">{title}</div>
        {description ? <div className="modal-desc">{description}</div> : null}
        {meta ? <div className="modal-meta">{meta}</div> : null}
        {actionLabel && onAction ? (
          <button className="modal-btn primary" onClick={onAction}>{actionLabel}</button>
        ) : null}
        <button className="modal-btn" onClick={onClose}>Ок</button>
      </div>
    </div>
  );
}
