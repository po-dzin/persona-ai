# Database migrations

Execution order:

1. `0001_schema.sql`
2. `0002_seed_packages.sql`
3. `0003_rls_baseline.sql`

Example (Postgres):

```bash
psql "$DATABASE_URL" -f infra/db/migrations/0001_schema.sql
psql "$DATABASE_URL" -f infra/db/migrations/0002_seed_packages.sql
psql "$DATABASE_URL" -f infra/db/migrations/0003_rls_baseline.sql
```
