/**
 * Datadog APM tracer bootstrap — must be imported before any other module
 * (see src/server.ts). No-op when no Datadog Agent is configured locally.
 *
 * TODO(M3): wire Datadog LLM Observability spans around
 * `src/services/bedrockClient.ts` calls so prompt/response/token/latency
 * data is captured and correlated with this same APM trace (FR-CHAT-003).
 */
if (process.env.DD_AGENT_HOST) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dd-trace").init({
    logInjection: true,
  });
}
