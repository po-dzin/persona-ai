import { useMemo, useState } from "react";

import { FilterChips } from "../components/FilterChips";
import { PhotoItem } from "../components/PhotoItem";
import { QueueCard } from "../components/QueueCard";
import { TopBar } from "../components/TopBar";
import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";

interface PhotosScreenProps {
  photos: PhotoRecord[];
  styles: StyleItem[];
  onOpenPhoto: (photo: PhotoRecord) => void;
}

export function PhotosScreen({ photos, styles, onOpenPhoto }: PhotosScreenProps) {
  const [filter, setFilter] = useState("Все");
  const queuedCount = photos.filter((photo) => photo.status === "queued" || photo.status === "processing").length;

  const filterItems = useMemo(() => ["Все", ...styles.map((style) => style.name)], [styles]);
  const styleByCode = useMemo(() => Object.fromEntries(styles.map((style) => [style.id, style])), [styles]);

  const filteredPhotos = photos.filter((photo) => {
    if (filter === "Все") return true;
    return styleByCode[photo.style_code]?.name === filter;
  });

  return (
    <section className="screen active">
      <TopBar title="Мои фото" />
      {queuedCount > 0 ? <QueueCard title="Очередь" count={queuedCount} /> : null}
      <FilterChips items={filterItems} selected={filter} onSelect={setFilter} />
      <div className="photos-grid">
        {filteredPhotos.map((photo) => (
          <PhotoItem key={photo.order_id} photo={photo} style={styleByCode[photo.style_code]} onOpen={() => onOpenPhoto(photo)} />
        ))}
      </div>
    </section>
  );
}
