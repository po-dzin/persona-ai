interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

export function Modal({ isOpen, title, description, actionLabel, onAction, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        <div className="modal-actions">
          {actionLabel && onAction ? <button onClick={onAction}>{actionLabel}</button> : null}
          <button className="ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
