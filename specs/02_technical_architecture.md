# 02 · Technical Architecture (Persona — Balanced MVP)

## 1) Why this architecture

Выбранный профиль: **speed + lightweight + multi-agent ready**.

- Preact вместо React: ~3KB vs ~40KB gzipped, то же API через compat
- Telegram Mini App first: оптимизация под WebView, быстрый cold start
- FastAPI backend: зрелый async framework, горизонтальный scaling
- Multi-agent development: чёткие контракты между модулями

## 2) Final stack

- **Frontend**: Preact + TypeScript + Vite (Mini App + Web shell)
  - `preact` + `preact/compat` (React API совместимость)
  - `@preact/signals` для реактивного state management (опционально)
  - Vite alias: `react` → `preact/compat`
  - Vanilla CSS с design tokens из `03_uiux_spec.md`
- **API**: FastAPI (Python 3.12)
- **Queue**: Redis + Celery workers
- **Scheduler**: Celery Beat (reconciliation + periodic checks)
- **DB**: Postgres
- **Storage**: S3-compatible object storage
- **AI providers**: Nano Banana, Stable Diffusion 3.5 Turbo, Recraft V4, OpenAI GPT-image-1.5, FLUX.1 Kontext [pro]
- **Payments**: Telegram Stars (primary)
- **Monitoring**: Sentry + structured logs

## 3) Frontend architecture

```
apps/web/
├── index.html                       # Entry point + Telegram WebApp SDK
├── vite.config.ts                   # Preact alias config
├── package.json
├── tsconfig.json
└── src/
    ├── main.tsx                     # Preact render + App mount
    ├── App.tsx                      # Root layout: screens + TabBar
    ├── styles/
    │   └── index.css                # Design tokens + component styles
    ├── components/                  # Shared UI components
    │   ├── TabBar.tsx
    │   ├── TopBar.tsx
    │   ├── QueueCard.tsx
    │   ├── StyleCard.tsx
    │   ├── PhotoItem.tsx
    │   ├── FilterChips.tsx
    │   ├── Modal.tsx
    │   └── CategoryTile.tsx
    ├── screens/                     # Full-screen views
    │   ├── HomeScreen.tsx
    │   ├── PhotosScreen.tsx
    │   ├── BalanceScreen.tsx
    │   ├── ProfileScreen.tsx
    │   ├── StylePreviewScreen.tsx
    │   ├── CategoryScreen.tsx
    │   ├── FlowStyleScreen.tsx
    │   ├── FlowUploadScreen.tsx
    │   ├── PhotoViewerScreen.tsx
    │   ├── PurchaseScreen.tsx
    │   └── ModelsPricingScreen.tsx
    ├── data/                        # Static data (moves to API later)
    │   ├── styles.ts
    │   └── models.ts
    ├── hooks/                       # Shared hooks
    │   ├── useScreen.ts             # Screen navigation state
    │   └── useTelegram.ts           # Telegram WebApp SDK bridge
    └── utils/
        └── api.ts                   # API client
```

### Preact migration (from React placeholder)

```diff
# vite.config.ts
+ import preact from '@preact/preset-vite'
  export default defineConfig({
+   plugins: [preact()],
    server: { port: 5173 }
  })

# package.json — replace react deps with preact
- "react": "^18.3.1"
- "react-dom": "^18.3.1"
+ "preact": "^10.x"
+ "@preact/preset-vite": "^2.x"
```

### Screen management (no router needed)

Прототип использует CSS opacity transitions между экранами. В React/Preact это маппится на:
- `useState<string>` для activeScreen
- `useState<string | null>` для overlay screens (style preview, viewer, purchase)
- CSS классы `.active` управляются через conditional rendering

## 4) Core services (backend)

- `api-gateway`: auth (Telegram initData), rate-limit, user/order endpoints
- `generation-orchestrator`: create jobs, dispatch to queue
- `worker`: runs provider calls, handles retries/download/upload
- `webhook-handler`: provider callbacks + payment callbacks
- `reconciliation`: periodic checker for stale/in-flight jobs

## 5) API boundaries (updated)

### Styles & catalog
- `GET /v1/styles` — каталог стилей с категориями (grouped)
- `GET /v1/styles/:id` — детали стиля (gradient, prompt template, examples)
- `GET /v1/categories` — список категорий

### Generation
- `POST /v1/generate` — создать генерацию (style_id + photo | custom prompt + model + photo)
- `GET /v1/jobs/:id` — статус генерации
- `GET /v1/me/photos` — галерея (фильтры: style, favorites, date)

### Economy
- `GET /v1/models` — AI модели и цены в монетах
- `GET /v1/me/balance` — баланс монет
- `GET /v1/packages` — доступные пакеты
- `POST /v1/purchase` — инициировать покупку пакета

### Payments
- `POST /webhooks/telegram` — Stars events
- `POST /webhooks/provider` — generation callbacks

### Profile
- `GET /v1/me` — профиль + stats
- `GET /v1/me/referral` — партнёрская программа

## 6) Security baseline

- Verify Telegram initData signature (HMAC)
- Verify provider webhook signature
- Signed URLs for private media access (S3 presigned)
- PII minimization and retention TTL jobs
- Rate limiting per user_id

## 7) Scaling path

1. Scale workers horizontally (Celery)
2. Provider routing (cost-aware by model + queue depth)
3. CDN for generated photos
4. Optional move to dedicated workflow engine
5. Optional GPU self-hosting when volume stabilizes
