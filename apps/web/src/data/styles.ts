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
    id: "glamour-90s",
    name: "Гламур 90-х",
    category: "Тренды",
    gradient: "linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
    prompt_template: "90s glamour portrait, glossy style, magazine lighting",
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
    name: "Бизнес-портрет",
    category: "Бизнес и карьера",
    gradient: "linear-gradient(145deg, #1E2040, #2E3870, #4A58A0)",
    prompt_template: "Professional business headshot, neutral background, sharp focus",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "Бизнес и карьера",
    gradient: "linear-gradient(145deg, #1E3A4A, #2E6890, #4A98C4)",
    prompt_template: "LinkedIn profile portrait, business casual, clean studio setup",
  },
  {
    id: "ceo-style",
    name: "CEO-стиль",
    category: "Бизнес и карьера",
    gradient: "linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
    prompt_template: "Executive ceo portrait, premium editorial look, confident pose",
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
  {
    id: "nature",
    name: "Природа",
    category: "Лайфстайл",
    gradient: "linear-gradient(145deg, #1E3D2A, #2E6B48, #4A9B70)",
    prompt_template: "Natural lifestyle portrait outdoors, soft sunlight, fresh colors",
  },
  {
    id: "vintage",
    name: "Винтаж",
    category: "Лайфстайл",
    gradient: "linear-gradient(145deg, #3D3020, #6B5530, #A08050)",
    prompt_template: "Vintage portrait session, film grain, retro wardrobe",
  },
  {
    id: "travel",
    name: "Путешествие",
    category: "Лайфстайл",
    gradient: "linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
    prompt_template: "Travel portrait near landmarks, bright daylight, candid mood",
  },
  {
    id: "cozy-evening",
    name: "Уютный вечер",
    category: "Лайфстайл",
    gradient: "linear-gradient(145deg, #3D1E3A, #6B2E64, #9B4A90)",
    prompt_template: "Cozy evening portrait, warm ambient lights, soft atmosphere",
    is_new: true,
  },
  {
    id: "oil-paint",
    name: "Масло",
    category: "Арт и креатив",
    gradient: "linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
    prompt_template: "Oil painting portrait, rich brush texture, gallery style",
  },
  {
    id: "comic",
    name: "Комикс",
    category: "Арт и креатив",
    gradient: "linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
    prompt_template: "Comic book portrait, bold outlines, high contrast colors",
  },
  {
    id: "wedding",
    name: "Свадьба",
    category: "Особый повод",
    gradient: "linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
    prompt_template: "Wedding portrait, elegant white tones, romantic cinematic lighting",
  },
  {
    id: "birthday",
    name: "День рождения",
    category: "Особый повод",
    gradient: "linear-gradient(145deg, #1E3D2A, #2E6B48, #4A9B70)",
    prompt_template: "Birthday celebration portrait, festive mood, colorful decorations",
  },
  {
    id: "graduation",
    name: "Выпускной",
    category: "Особый повод",
    gradient: "linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
    prompt_template: "Graduation portrait, academic robe, celebratory style",
  },
];
