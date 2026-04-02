# 09 · Multi-Agent Development Spec

## 1) Purpose

Спецификация для безопасной параллельной разработки несколькими AI-агентами. Каждый агент работает над своей зоной ответственности с минимальным риском конфликтов.

## 2) File ownership boundaries

### Agent A: Frontend — Screens & Pages

```
OWNS (exclusive write):
  apps/web/src/screens/*.tsx
  apps/web/src/App.tsx

READS (no write):
  apps/web/src/components/*.tsx
  apps/web/src/styles/index.css
  apps/web/src/data/*.ts
  specs/*.md
```

### Agent B: Frontend — Components & Design System

```
OWNS (exclusive write):
  apps/web/src/components/*.tsx
  apps/web/src/styles/index.css

READS (no write):
  apps/web/src/screens/*.tsx  (to verify usage)
  apps/web/src/styles/TOKEN_CONTRACT.md  (design tokens source)
```

### Agent C: Frontend — Data, Hooks & Utils

```
OWNS (exclusive write):
  apps/web/src/data/*.ts
  apps/web/src/hooks/*.ts
  apps/web/src/utils/*.ts
  apps/web/src/main.tsx

READS (no write):
  apps/web/src/screens/*.tsx
  apps/web/src/components/*.tsx
  specs/02_technical_architecture.md
```

### Agent D: Backend API

```
OWNS (exclusive write):
  apps/api/**
  workers/**
  shared/contracts/**

READS (no write):
  specs/*.md
  apps/web/src/utils/api.ts  (to verify contract)
```

### Agent E: Specs & Configuration

```
OWNS (exclusive write):
  specs/*.md
  infra/**
  apps/web/vite.config.ts
  apps/web/package.json
  apps/web/tsconfig.json
  apps/web/index.html

READS (no write):
  apps/web/src/**
  apps/api/**
```

## 3) Shared contracts (interface files)

Файлы-контракты, которые читаются всеми и модифицируются только через согласованный процесс:

```
shared/contracts/
├── api-types.ts          # TypeScript types for API request/response
├── screen-names.ts       # Enum of screen IDs
├── event-names.ts        # Custom events for cross-component communication
└── style-types.ts        # Style, Category, AIModel interfaces
```

### Правила модификации контрактов

1. Контракт модифицирует **только Agent E** (Specs) или агент-владелец домена
2. Перед изменением контракта — обновить соответствующий spec
3. Контракт расширяется аддитивно (новые поля optional)
4. Удаление полей — только через deprecation cycle

## 4) Component interface contracts

Каждый компонент в `components/` экспортирует:

```typescript
// Пример: StyleCard.tsx
interface StyleCardProps {
  name: string;
  gradientClass: string;   // 's1' | 's2' | ... | 's8'
  tag?: 'fire' | 'new';
  onClick?: () => void;
}

export function StyleCard(props: StyleCardProps): JSX.Element;
```

### Правила:

- Props interface всегда экспортируется и именуется `{Component}Props`
- Компонент не имеет внутреннего side-effect state (чистая функция от props)
- Callbacks в props именуются `on{Action}` (onClick, onSelect, onClose)
- Компонент стилизуется через CSS классы из `index.css`, не inline styles

## 5) Screen interface contracts

Каждый screen в `screens/` принимает:

```typescript
interface ScreenProps {
  isActive: boolean;               // Управляется из App.tsx
  onNavigate: (screen: string) => void;  // Навигация
}
```

Overlay screens добавляют:

```typescript
interface OverlayScreenProps extends ScreenProps {
  onClose: () => void;
  context?: Record<string, any>;   // Данные из вызывающего экрана
}
```

## 6) Conflict prevention rules

### Rule 1: One file = one owner
Каждый файл принадлежит ровно одному агенту. Два агента не могут одновременно модифицировать один файл.

### Rule 2: Interface-first
Перед реализацией — определить interface в контрактном файле. Зависимые агенты импортируют types, а не конкретную реализацию.

### Rule 3: Additive-only changes
При параллельной работе все изменения аддитивны:
- Новые файлы — ок
- Новые exports из существующих файлов — ок
- Изменение существующих exports — только через координацию

### Rule 4: CSS namespace isolation
Каждый компонент/screen использует CSS классы с уникальным префиксом из prototype:
- Components: `.style-card`, `.queue-single`, `.filter-chip`, etc.
- Screens: `.screen`, `.flow-screen`, `.viewer-screen`, etc.
- **Запрещено**: глобальные CSS правила без scope (кроме resets в index.css)

### Rule 5: No cross-screen imports
Screens не импортируют друг друга. Коммуникация только через:
- Props из App.tsx
- Shared hooks
- Contract types

## 7) Development sequence (dependency order)

```
Phase 0 (Agent E):  specs + package.json + vite.config + contracts
    ↓
Phase 1 (Agent B):  index.css design system + base components
Phase 1 (Agent C):  data/*.ts + hooks + utils (parallel with B)
    ↓
Phase 2 (Agent A):  screens (depends on components + data)
Phase 2 (Agent D):  API endpoints (parallel with frontend)
    ↓
Phase 3 (Agent C):  connect screens to API (hooks + utils/api.ts)
```

## 8) Testing boundaries

| Agent | Test responsibility |
|-------|-------------------|
| A (Screens) | Visual snapshot tests, screen state transitions |
| B (Components) | Component unit tests, props validation |
| C (Data/Hooks) | Hook unit tests, API mock tests |
| D (Backend) | API integration tests, domain logic tests |
| E (Specs) | Build verification, lint, type-check |

## 9) Communication protocol

При необходимости координации между агентами:

1. **Нужен новый компонент**: Agent A добавляет interface в contracts → Agent B реализует
2. **Нужен новый API endpoint**: Agent A/C описывает в contracts/api-types.ts → Agent D реализует
3. **Нужно изменить design token**: Agent A/B обновляет specs → Agent E утверждает → Agent B применяет в CSS
