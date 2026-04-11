import type { Style } from "../../../../shared/contracts/domain";
import styleSpecsJson from "../../../../shared/contracts/style_specs.json";

interface RawStyleSpec {
  id: string;
  name: string;
  category: string;
  gradient: string;
  promptTemplate: string;
  isTrending?: boolean;
  isNew?: boolean;
}

const rawStyles = styleSpecsJson as RawStyleSpec[];

export const FALLBACK_STYLES: Style[] = rawStyles.map((style) => ({
  id: style.id,
  name: style.name,
  category: style.category,
  gradient: style.gradient,
  promptTemplate: style.promptTemplate,
  isTrending: style.isTrending,
  isNew: style.isNew,
}));

export type StyleItem = Style;
