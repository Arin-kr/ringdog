/**
 * Structured JSON logger shared by all Node services (backend-api, chatbot-service,
 * order-consumer). Every log line is a single JSON object so the Datadog Agent's
 * `source: nodejs` log pipeline can parse it without a custom grok rule.
 *
 * dd-trace's `logInjection: true` (set in each app's src/tracer.ts) only auto-injects
 * `dd.trace_id`/`dd.span_id` into logs written through a *supported* logging library
 * (winston/bunyan/pino) - it does nothing for plain `console.log`. Since this repo
 * doesn't use one of those, we pull the active span's trace/span id ourselves via the
 * `dd-trace` singleton and attach them under `dd.trace_id`/`dd.span_id`, which is the
 * attribute path Datadog's log-trace correlation looks for. This only requires that
 * `require("dd-trace").init()` has already run in the process (see each app's
 * src/tracer.ts, imported before anything else in every entrypoint) - importing this
 * module never calls `.init()` itself.
 */
import tracer from "dd-trace";

export type LogFields = Record<string, unknown>;

type Level = "info" | "warn" | "error";

function write(level: Level, message: string, fields: LogFields = {}): void {
  const spanContext = tracer.scope().active()?.context();

  const entry: LogFields = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };

  if (spanContext) {
    entry.dd = {
      trace_id: spanContext.toTraceId(),
      span_id: spanContext.toSpanId(),
    };
  }

  const line = JSON.stringify(entry);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
