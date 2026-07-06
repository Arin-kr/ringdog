# @ringdog/backend-api

Express service exposing auth, catalog/search, cart, and order APIs, and
publishing `OrderPlaced` events to Kafka/MSK. See `PRD_v1.yaml`
`application_components.backend_api` and `api_contracts` for the full
contract.

## Local dev

```bash
pnpm --filter @ringdog/backend-api run dev
```

Requires `DATABASE_URL` (Postgres) and `KAFKA_BROKERS` reachable — see the
repo-root `docker-compose.yml` and `.env.example`.

## M1 skeleton status

This package is at the M1/skeleton milestone: routes are real and backed by
Prisma, but the following are intentionally deferred:

- **OpenSearch search** (`src/lib/opensearch.ts`): `GET /api/products/search`
  currently falls back to a Prisma `contains` filter. M2 should wire the
  route to a real OpenSearch query for FR-SEARCH-001 / NFR-PERF-001.
- **Kafka publish reliability** (`src/lib/kafka.ts`): `publishOrderPlaced`
  has no retry/backoff or DLQ compensation yet. M2/M4 should add this per
  `sync_strategy.failure_handling` and FR-ORDER-002.
- **Coupon edge cases**: only the exact `DEMO_COUPON_CODE` match is
  handled; expiry, per-user limits, and invalid-coupon messaging are out of
  scope for M1.
