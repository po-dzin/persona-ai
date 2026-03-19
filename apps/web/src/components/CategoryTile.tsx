interface CategoryTileProps {
  title: string;
  count: number;
}

export function CategoryTile({ title, count }: CategoryTileProps) {
  return (
    <div className="category-tile">
      <div className="category-title">{title}</div>
      <div className="category-count">{count} стилей</div>
    </div>
  );
}
