/**
 * Datadog APM tracer bootstrap — must be imported before any other module
 * (see src/server.ts) and before the logger, so dd-trace can patch modules
 * at require-time. No-op when no Datadog Agent is configured locally.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tracer = require("dd-trace");

if (process.env.DD_AGENT_HOST) {
  tracer.init({
    logInjection: true,
  });

  // The express integration's "middleware" span is just a wrapper around
  // whichever handler actually runs and shows up unnamed/<anonymous> in the
  // trace (https://github.com/DataDog/dd-trace-js/issues/1257) - it adds
  // noise without adding information, so turn it off.
  tracer.use("express", { middleware: false });
}

// LLM Observability span wrapping for src/services/bedrockClient.ts
// (FR-CHAT-003). Enabled via DD_LLMOBS_ENABLED/DD_LLMOBS_ML_APP env vars
// (see deploy/helm/charts/ringdog/templates/chatbot-service.yaml) - routed
// through the same Datadog Agent as the APM traces above, so no DD_API_KEY
// is needed in this container. Safe to import/use even when DD_AGENT_HOST
// is unset (e.g. local dev) - just a no-op.
export const llmobs = tracer.llmobs;
