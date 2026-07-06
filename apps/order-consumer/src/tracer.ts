/**
 * Datadog APM tracer bootstrap — must be imported before any other module
 * (see src/index.ts) so dd-trace can instrument kafkajs/Prisma at
 * require-time. No-op when no Datadog Agent is configured locally.
 */
if (process.env.DD_AGENT_HOST) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dd-trace").init({
    logInjection: true,
  });
}
