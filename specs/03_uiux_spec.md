# 03 · UI/UX Spec (Persona — Telegram Mini App + Web)

## 1) UX principles (сохранены + дополнены)

### Из оригинальных спецификаций
- **Trust-first**: прозрачность статусов, стоимости и ограничений
- **Value-fast**: пользователь видит каталог и тренды с первого экрана
- **Low-friction**: минимум шагов до генерации (2 шага: стиль → фото)
- **Consistent surfaces**: Mini App и Web повторяют одну информационную архитектуру

### Новые для Persona v59
- **Inspiration-first**: каталог стилей вдохновляет на генерацию (browse → discover → create)
- **Coin transparency**: стоимость каждой модели видна до генерации
- **Queue-aware**: очередь генерации видна на каждом экране (Главная + Мои фото)
- **Native feel**: ощущение нативного приложения (transitions, touch feedback, sticky bars)

## 2) Core screens

### Навигация: 5-tab bar

| Tab | Экран | Icon |
|-----|-------|------|
| Главная | Каталог стилей | 🏠 Home |
| Мои фото | Галерея результатов | 🖼 Grid + badge |
| ✨ AI | Создание генерации (center button, gradient #A78BFA → #7C3AED) | ✨ Sparkle |
| Баланс | Монеты + пакеты | ⭐ Star |
| Профиль | Статистика, партнёрка, помощь | 👤 User |

### Overlay screens (поверх tab bar)

- **Style Preview** — полноэкранный просмотр стиля (z=22)
- **Category Page** — все стили в категории (z=20)
- **Flow: Step 1** — выбор стиля / кастом (z=20)
- **Flow: Step 2** — загрузка фото (z=20)
- **Photo Viewer** — просмотр сгенерированного фото (z=25)
- **Purchase Screen** — подтверждение покупки (z=25)
- **Models Pricing** — стоимость AI моделей (z=20)

### Modal overlays (z=50, над всем)

- Added to Queue
- Sent to Telegram
- Purchase Success

## 3) Design Tokens (из prototype v59)

### Color palette

```
--bg-primary:        #111111     /* App background */
--bg-surface:        #1A1A1A     /* Cards, inputs */
--bg-surface-hover:  #222222     /* Pressed/hover state */
--bg-elevated:       #2A2A2A     /* Buttons, chips, surface-2 */
--bg-body:           #0A0A0A     /* Body behind phone */

--text-primary:      #F0F0F0     /* Headings, main text */
--text-secondary:    #888888     /* Descriptions, labels */
--text-tertiary:     #666666     /* Hints, username */
--text-muted:        #555555     /* Timestamps, step counter */
--text-disabled:     #444444     /* Placeholders */

--accent-primary:    #8B83D4     /* Main brand (flow buttons, tags, dots) */
--accent-gradient:   linear-gradient(145deg, #A78BFA, #7C3AED)  /* CTA buttons, AI tab */
--accent-light:      #A78BFA     /* Links, share buttons */
--accent-bg:         rgba(167, 139, 250, 0.15)  /* Selected state bg */
--accent-border:     rgba(167, 139, 250, 0.4)   /* Selected state border */

--red:               #E24B4A     /* Tags (Hot), badge, logout */
--green:             #4ADE80     /* Success, bonus text */
--gold:              #FFD666 / #F0A820  /* Coin icon */
--tg-blue:           #3888FF     /* Telegram, Stars icon */

--border-subtle:     rgba(255, 255, 255, 0.04)  /* Dividers between rows */
--border-default:    rgba(255, 255, 255, 0.06)  /* Card borders, top bar */
--border-hover:      rgba(255, 255, 255, 0.08)  /* Active card border */
--border-accent:     rgba(255, 255, 255, 0.15)  /* Modal buttons */
```

### Typography

```
--font-family:       'DM Sans', sans-serif

/* Sizes */
--text-xs:           9px    /* Tags */
--text-sm:           10px   /* Labels, stat-label */
--text-body-sm:      11px   /* Descriptions, hints */
--text-body:         12px   /* Section links, filter chips */
--text-body-md:      13px   /* Queue title, viewer text */
--text-body-lg:      14px   /* Inputs, package name, profile rows */
--text-heading-sm:   15px   /* Flow buttons */
--text-heading:      16px   /* Section titles, flow titles */
--text-heading-lg:   17px   /* Modal title */
--text-title:        18px   /* Top bar, logo, profile name */
--text-display-sm:   20px   /* Profile stat values */
--text-display:      22px   /* Success balance */
--text-display-lg:   28px   /* Style preview name */
--text-display-xl:   36px   /* Balance amount */

/* Weights */
--font-normal:       400
--font-medium:       500
--font-semibold:     600
--font-bold:         700
```

### Spacing

```
--space-2:           2px    /* Grid gaps, stat gaps */
--space-3:           3px    /* Tab padding, chip labels gap */
--space-4:           4px    /* Dots gap, queue-dots */
--space-6:           6px    /* Filter gap, ratio gap, padding-bottom */
--space-8:           8px    /* Category grid pad-top, row gaps */
--space-10:          10px   /* Style card gap, category grid gap */
--space-12:          12px   /* Queue padding, upload gap */
--space-14:          14px   /* Card padding, prompt padding */
--space-16:          16px   /* Standard horizontal padding */
--space-20:          20px   /* Section padding, body padding */
--space-24:          24px   /* Profile header, modal padding */
--space-28:          28px   /* Bottom bar padding-bottom, overlay gradient */
```

### Radii

```
--radius-sm:         6px    /* Tags */
--radius-md:         8px    /* Flow tab, copy btn, partner link */
--radius-lg:         10px   /* Queue thumb, ratio chip, profile icon */
--radius-xl:         12px   /* Inputs, viewer actions, profile card */
--radius-2xl:        14px   /* Cards, buttons, package card, flow btn */
--radius-3xl:        16px   /* Purchase summary */
--radius-4xl:        20px   /* Upload area, filter chips */
--radius-5xl:        28px   /* Modal card */
--radius-full:       50%    /* Avatars, dots, back buttons */
--radius-phone:      32px   /* Phone container */
```

### Shadows & effects

```
--shadow-phone:      0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)
--shadow-ai-btn:     0 0 16px rgba(124,58,237,0.5), 0 0 4px rgba(167,139,250,0.3)
--shadow-coin:       0 4px 20px rgba(240,168,32,0.25)

--transition-fast:   0.15s
--transition-normal: 0.2s
--transition-medium: 0.25s
--transition-slow:   0.3s

--blur-glass:        blur(8px)
--blur-modal:        blur(12px)
```

### Z-index scale

```
--z-sticky:          5     /* Top bars, flow-top */
--z-tab-bar:         40    /* Bottom tab bar */
--z-flow:            20    /* Flow screens, category */
--z-preview:         22    /* Style preview */
--z-viewer:          25    /* Photo viewer, purchase */
--z-modal:           50    /* Modal overlays */
```

### Layout constants

```
--phone-width:       375px
--phone-height:      812px
--tab-bar-height:    68px
--top-bar-height:    ~52px (padding: 16px 20px 12px)
--style-card-width:  130px  /* min-width */
--style-card-ratio:  3/4
--photo-grid-cols:   3
--category-grid-cols: 2
```

## 4) Style gradients map (8 presets)

```
s1: linear-gradient(145deg, #3D2855, #6B3FA0, #9B6BD4)  /* Purple */
s2: linear-gradient(145deg, #1E3A4A, #2E6890, #4A98C4)  /* Blue */
s3: linear-gradient(145deg, #3D3020, #6B5530, #A08050)  /* Brown */
s4: linear-gradient(145deg, #1E3D2A, #2E6B48, #4A9B70)  /* Green */
s5: linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)  /* Pink */
s6: linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)  /* Olive */
s7: linear-gradient(145deg, #1E2040, #2E3870, #4A58A0)  /* Indigo */
s8: linear-gradient(145deg, #3D1E3A, #6B2E64, #9B4A90)  /* Magenta */
```

## 5) UX state machine

```
idle → style_browsing → style_selected → photo_uploading → photo_uploaded → generation_queued → processing → done
                                                                              ↘ failed_recoverable (retry)
                                                                              ↘ failed_non_recoverable (support)
```

## 6) Mandatory UX behaviors (из оригинальной спеки + дополнения)

- До запуска генерации всегда показываем стоимость в монетах
- Очередь генерации видна на Главной (queue-single / queue-stack)
- На «Мои фото» очередь дублируется + loading-карточки в гриде
- Photo viewer: промпт + кнопки (Stories, Скачать, Telegram, Использовать, Поделиться)
- На ошибке всегда есть recovery path (retry или upload another)
- Filter chips в «Мои фото» — по стилю + «Избранное»

## 7) Copy contract

- Time promise: «Обычно 30–120 секунд»
- Trust copy: «Фото удаляется по политике хранения»
- Quality copy: «Лучше работают четкие портреты с хорошим освещением»
- Honesty copy: «Итог может немного отличаться от превью»
- Upload hint: «JPG, PNG · до 20 МБ»
