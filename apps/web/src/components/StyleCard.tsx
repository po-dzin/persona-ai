import type { StyleItem } from "../data/styles";

interface StyleCardProps {
  style: StyleItem;
  onClick: (style: StyleItem) => void;
}

export function StyleCard({ style, onClick }: StyleCardProps) {
  return (
    <button className="style-card" style={{ background: style.gradient }} onClick={() => onClick(style)}>
      <span className="style-name">{style.name}</span>
      {style.is_trending ? <span className="style-tag fire">Hot</span> : null}
      {style.is_new ? <span className="style-tag new">New</span> : null}
    </button>
  );
}
