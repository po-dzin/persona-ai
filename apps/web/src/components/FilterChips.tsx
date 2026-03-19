interface FilterChipsProps {
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
}

export function FilterChips({ items, selected, onSelect }: FilterChipsProps) {
  return (
    <div className="filter-row">
      {items.map((item) => (
        <button key={item} className={`filter-chip ${selected === item ? "active" : ""}`} onClick={() => onSelect(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}
