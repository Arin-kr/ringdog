# @ringdog/chatbot-service

Express service handling chat sessions/messages, building conversation
context from the DB, and calling Amazon Bedrock. See `PRD_v1.yaml`
`application_components.chatbot_service` and `api_contracts.chatbot`.

## Local dev

```bash
pnpm --filter @ringdog/chatbot-service run dev
```

`BEDROCK_MOCK_MODE=true` (the `.env.example` default) returns a canned
response with no AWS calls, so this runs without any AWS credentials.

## M3 TODOs

- **Streaming responses**: `src/services/bedrockClient.ts` currently does a
  single non-streaming `InvokeModelCommand`. FR-CHAT-002/NFR-PERF-003 call
  for low time-to-first-token; wire up
  `InvokeModelWithResponseStreamCommand` and stream to the client.
- **Datadog LLM Observability**: FR-CHAT-003 requires prompt/response/token
  usage/latency to be recorded as LLM spans correlated with the APM trace.
  Not yet wired in `src/tracer.ts` / `src/services/bedrockClient.ts`.
- **Real prompt engineering**: `src/services/contextBuilder.ts` is a
  minimal stub (last order only); expand with catalog search context and
  better system prompts.
