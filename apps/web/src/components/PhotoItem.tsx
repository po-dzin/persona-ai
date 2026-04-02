import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";

interface PhotoItemProps {
  photo: PhotoRecord;
  style?: StyleItem;
  onOpen?: () => void;
}

export function PhotoItem({ photo, style, onOpen }: PhotoItemProps) {
  const isLoading = photo.status === "queued" || photo.status === "processing";
  const bg = style?.gradient || "var(--sem-gradient-photo-fallback)";

  return (
    <button className={`photo-item ${isLoading ? "loading" : ""}`} onClick={onOpen} disabled={isLoading}>
      <div className="photo-bg" style={{ background: bg }} />
      <div className="photo-style-label">{style?.name || photo.styleCode}</div>
      {isLoading ? <div className="photo-loading">...</div> : null}
    </button>
  );
}
