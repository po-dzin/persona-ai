# Database migrations

Execution order:

1. `0001_schema.sql`
2. `0002_seed_packages.sql`

Example (Postgres):

```bash
psql "$DATABASE_URL" -f infra/db/migrations/0001_schema.sql
psql "$DATABASE_URL" -f infra/db/migrations/0002_seed_packages.sql
```
