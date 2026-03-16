# 06 · Technical Architecture Diagrams (Mermaid)

Этот документ — канонический визуальный слой для `02_technical_architecture.md`.

## 1) System architecture (MVP + Phase markers)

```mermaid
flowchart LR
  classDef mvp fill:#eef6ff,stroke:#3b82f6,stroke-width:1px,color:#0f172a;
  classDef p11 fill:#fff7ed,stroke:#f59e0b,stroke-dasharray: 5 5,color:#7c2d12;
  classDef p2 fill:#f5f3ff,stroke:#8b5cf6,stroke-dasharray: 5 5,color:#3b0764;

  subgraph C[Client Surfaces]
    MA[Telegram Mini App]
    WEB[Web App]
  end

  subgraph E[Edge/API]
    API[FastAPI API Gateway]
    WH[Webhook Handler\nReplicate + Telegram + Stripe]
  end

  subgraph O[Orchestration]
    CE[Credit Engine]
    Q[Redis + Celery Queue]
    W[Celery Worker]
    RC[Celery Beat + Reconciliation Job]
  end

  subgraph D[Data + Storage]
    DB[(Postgres)]
    OBJ[(Object Storage)]
  end

  subgraph X[External Providers]
    REP[Replicate\nLivePortrait primary]
    RW[Runway Gen-4 Turbo\nfallback]
    TG[Telegram Stars]
    ST[Stripe]
  end

  MA --> API
  WEB --> API
  API --> CE
  CE --> DB
  CE --> Q
  Q --> W
  W --> REP
  W -. fallback .-> RW
  W --> OBJ
  W --> DB

  REP -->|callback| WH
  TG -->|payment webhook| WH
  ST -->|payment webhook| WH
  WH --> DB
  WH --> OBJ
  WH --> API

  RC --> DB
  RC --> REP

  P11[Phase 1.1\nGifts + Referrals + Dashboard]:::p11
  P2[Phase 2\nMulti-provider router + optional self-hosted GPU]:::p2

  API -. extends .-> P11
  W -. evolves .-> P2

  class MA,WEB,API,WH,CE,Q,W,RC,DB,OBJ,REP,RW,TG,ST mvp;
```

## 2) Order sequence: upload → credit check → queue → callback → result/refund

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant APP as Mini App / Web
  participant API as API Gateway
  participant CE as Credit Engine
  participant DB as Postgres
  participant Q as Redis Queue
  participant W as Worker
  participant RP as Replicate
  participant WH as Webhook Handler

  U->>APP: Upload photo + choose style
  APP->>API: POST /v1/orders/start
  API->>CE: check credits/free_eligibility
  CE->>DB: read wallet + free_credits_granted

  alt Credits available (free or paid)
    CE->>DB: reserve/debit 1 credit (atomic)
    CE-->>API: approved
  else No credits
    CE-->>API: paywall_required
    API-->>APP: 402-style business response
  end

  API->>DB: create order + generation_job=queued
  API->>Q: enqueue generation task
  Q->>W: deliver task
  W->>RP: submit generation with callback_url
  RP-->>WH: provider callback (processing/done/failed)
  WH->>DB: insert webhook_events(provider,event_id)
  WH->>DB: idempotent job/order update

  alt Done
    WH->>DB: set order=done, persist result asset
    WH-->>APP: status update / polling result
  else Technical failure
    WH->>DB: set order=failed + credit refund tx
    WH-->>APP: error + retry path
  else Policy/content failure
    WH->>DB: set order=failed (no auto-refund)
    WH-->>APP: policy rejection message
  end
```

## 3) Phase boundaries

- MVP: `Mini App + Web`, `FastAPI`, `Redis + Celery Workers + Celery Beat`, `Postgres`, `Object Storage`, `Replicate + Runway fallback`, `Stars + Stripe`, `Webhook + Reconciliation`.
- Phase 1.1: `Gifts`, `Referrals`, `Profile dashboards`.
- Phase 2: `Multi-provider routing`, `optional self-hosted GPU`.
