# @ringdog/order-consumer

Kafka consumer that reacts to `OrderPlaced` events published by
`@ringdog/backend-api` and asynchronously moves the order from `PENDING` to
`PAID`, simulating payment completion. See `PRD_v1.yaml`
`application_components.order_consumer`.

Exposes a minimal HTTP `GET /health` on `ORDER_CONSUMER_HEALTH_PORT`
(default 4002) for k8s liveness/readiness probes — it has no other HTTP
surface.

## Local dev

```bash
pnpm --filter @ringdog/order-consumer run dev
```

## M4 TODOs

- **Retry/backoff + DLQ**: `src/consumers/orderPlacedConsumer.ts` currently
  just logs and drops failed messages. Add exponential backoff retry and a
  dead-letter topic per PRD `sync_strategy.failure_handling` and
  NFR-REL-002 (event loss < 0.1%).
- **Datadog DSM verification**: confirm dd-trace's kafkajs instrumentation
  emits Data Streams Monitoring spans end-to-end with backend-api's
  producer side.
