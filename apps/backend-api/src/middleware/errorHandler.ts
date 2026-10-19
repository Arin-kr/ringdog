import tracer from "dd-trace";
import { NextFunction, Request, Response } from "express";
import { logger } from "@ringdog/shared";

export interface HttpError extends Error {
  status?: number;
}

/**
 * Final error-handling middleware. Keep this last in the middleware chain
 * (see src/app.ts). Logs a structured JSON line so Datadog Agent log
 * collection can pick it up and correlate it with the active APM trace.
 *
 * For 5xx errors it also emits Datadog's standard `error.kind` /
 * `error.message` / `error.stack` log attributes and tags the active span
 * with the error object, so Error Tracking groups the issue with a real
 * stack trace (the http-level 500 alone carries no stack).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status ?? 500;
  const isServerError = status >= 500;

  logger.error(err.message, {
    status,
    path: req.path,
    method: req.method,
    ...(isServerError && {
      error: { kind: err.name, message: err.message, stack: err.stack },
    }),
  });

  if (isServerError) {
    tracer.scope().active()?.setTag("error", err);
  }

  res.status(status).json({
    error: {
      message: isServerError ? "Internal server error" : err.message,
    },
  });
}
