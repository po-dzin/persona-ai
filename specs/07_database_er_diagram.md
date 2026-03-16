# 07 · Database ER Diagram (Mermaid)

Этот документ синхронизирован с `specs/schema.sql` и `05_database_spec.md`.

## 1) ER diagram (MVP core + Phase 1.1 extension)

```mermaid
erDiagram
  USERS ||--|| WALLETS : has
  USERS ||--o{ ORDERS : places
  USERS ||--o{ PAYMENTS : makes
  USERS ||--o{ MEDIA_ASSETS : owns
  USERS ||--o{ WALLET_TRANSACTIONS : receives

  WALLETS ||--o{ WALLET_TRANSACTIONS : ledger_entries

  PACKAGES ||--o{ PAYMENTS : purchased_as
  PACKAGES ||--o{ GIFT_PACKAGES : gifted_package

  PAYMENTS ||--o{ WALLET_TRANSACTIONS : purchase_credit_tx

  ORDERS ||--o{ GENERATION_JOBS : executes_as
  ORDERS ||--o{ MEDIA_ASSETS : attaches_media
  ORDERS ||--o{ WALLET_TRANSACTIONS : debit_or_refund_tx

  USERS ||--o{ REFERRALS : referrer_phase_1_1
  USERS ||--o| REFERRALS : referred_phase_1_1

  USERS ||--o{ GIFT_PACKAGES : sender_phase_1_1
  USERS ||--o{ GIFT_PACKAGES : receiver_phase_1_1

  USERS {
    uuid id PK
    bigint telegram_user_id UK
    text web_user_external_id UK
    text username
    boolean free_credits_granted
    timestamptz created_at
  }

  WALLETS {
    uuid id PK
    uuid user_id FK_UK
    int balance_credits
    timestamptz updated_at
  }

  PACKAGES {
    uuid id PK
    text code UK
    text title
    int credits
    int price_amount
    text currency
    text provider
    bool is_active
  }

  PAYMENTS {
    uuid id PK
    uuid user_id FK
    uuid package_id FK
    text provider
    text external_charge_id UK_COMPOSITE_PROVIDER
    int amount
    text currency
    text status
    timestamptz paid_at
  }

  ORDERS {
    uuid id PK
    uuid user_id FK
    text style_code
    text status
    int credit_cost
    bool is_free_credit_used
    uuid source_asset_id FK
    uuid result_asset_id FK
    text idempotency_key UK
    timestamptz requested_at
    timestamptz updated_at
  }

  GENERATION_JOBS {
    uuid id PK
    uuid order_id FK
    text provider
    text provider_task_id UK_COMPOSITE_PROVIDER
    text status
    int attempts
    text error_code
    timestamptz updated_at
  }

  MEDIA_ASSETS {
    uuid id PK
    uuid user_id FK
    uuid order_id FK
    text kind
    text storage_bucket
    text storage_key UK_COMPOSITE_BUCKET
    timestamptz expires_at
  }

  WALLET_TRANSACTIONS {
    uuid id PK
    uuid wallet_id FK
    uuid user_id FK
    uuid order_id FK
    uuid payment_id FK
    text tx_type
    int delta_credits
    timestamptz created_at
  }

  WEBHOOK_EVENTS {
    uuid id PK
    text provider
    text event_id UK_COMPOSITE_PROVIDER
    text event_type
    text processing_status
    timestamptz received_at
  }

  REFERRALS {
    uuid id PK
    uuid referrer_user_id FK
    uuid referred_user_id FK_UK
    text referral_code
    numeric reward_percent
    timestamptz created_at
  }

  GIFT_PACKAGES {
    uuid id PK
    uuid sender_user_id FK
    uuid receiver_user_id FK
    uuid package_id FK
    text gift_token UK
    text status
    timestamptz redeemed_at
  }
```

## 2) Critical uniqueness / idempotency constraints

- `users.telegram_user_id` unique.
- `users.web_user_external_id` unique.
- `wallets.user_id` unique (1 wallet per user).
- `payments (provider, external_charge_id)` composite unique.
- `generation_jobs (provider, provider_task_id)` composite unique.
- `webhook_events (provider, event_id)` composite unique.
- `orders.idempotency_key` unique.

## 3) MVP vs Phase markers

- MVP core: `users`, `wallets`, `wallet_transactions`, `packages`, `payments`, `orders`, `generation_jobs`, `media_assets`, `webhook_events`.
- Phase 1.1 extension: `referrals`, `gift_packages`.
