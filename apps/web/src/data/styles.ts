export interface StyleItem {
  id: string;
  name: string;
  category: string;
  gradient: string;
  prompt_template: string;
  is_trending?: boolean;
  is_new?: boolean;
}

export const FALLBACK_STYLES: StyleItem[] = [
  {
    id: "hollywood",
    name: "Голливуд",
    category: "Тренды",
    gradient: "linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
    prompt_template: "Cinematic hollywood portrait, dramatic lighting, premium retouch",
    is_trending: true,
  },
  {
    id: "cyberpunk",
    name: "Киберпанк",
    category: "Тренды",
    gradient: "linear-gradient(145deg, #1E3A4A, #2E6890, #4A98C4)",
    prompt_template: "Cyberpunk portrait, neon accents, glossy editorial mood",
    is_new: true,
  },
  {
    id: "business",
    name: "Бизнес",
    category: "Бизнес и карьера",
    gradient: "linear-gradient(145deg, #1E2040, #2E3870, #4A58A0)",
    prompt_template: "Professional business headshot, neutral background, sharp focus",
  },
  {
    id: "k-pop",
    name: "K-pop",
    category: "Тренды",
    gradient: "linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
    prompt_template: "K-pop idol concept portrait, pastel palette, studio lighting",
  },
  {
    id: "anime",
    name: "Аниме",
    category: "Арт и креатив",
    gradient: "linear-gradient(145deg, #3D1E3A, #6B2E64, #9B4A90)",
    prompt_template: "Anime inspired portrait, cel shading, expressive eyes",
    is_new: true,
  },
];
