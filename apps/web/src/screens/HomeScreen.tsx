import type { StyleItem } from "../data/styles";

import { CategoryTile } from "../components/CategoryTile";
import { StyleCard } from "../components/StyleCard";
import { TopBar } from "../components/TopBar";

interface HomeScreenProps {
  styles: StyleItem[];
  onPickStyle: (style: StyleItem) => void;
}

export function HomeScreen({ styles, onPickStyle }: HomeScreenProps) {
  const categoryCounts = styles.reduce<Record<string, number>>((acc, style) => {
    acc[style.category] = (acc[style.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="screen active">
      <TopBar title="Главная" />

      <div className="section-title">Категории</div>
      <div className="category-grid">
        {Object.entries(categoryCounts).map(([category, count]) => (
          <CategoryTile key={category} title={category} count={count} />
        ))}
      </div>

      <div className="section-title">Трендовые стили</div>
      <div className="styles-grid">
        {styles.map((style) => (
          <StyleCard key={style.id} style={style} onClick={onPickStyle} />
        ))}
      </div>
    </section>
  );
}
