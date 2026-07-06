/**
 * Datadog APM tracer bootstrap.
 *
 * This module MUST be imported before any other module (see src/server.ts) so
 * that dd-trace can patch Node's core modules and supported libraries before
 * they are required elsewhere.
 *
 * In local dev without a Datadog Agent running, DD_AGENT_HOST is typically
 * unset/empty, so this is a no-op and the service still boots normally.
 */
if (process.env.DD_AGENT_HOST) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dd-trace").init({
    logInjection: true,
  });
}
