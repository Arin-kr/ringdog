import { NextFunction, Request, Response } from "express";
import { logger } from "@ringdog/shared";

export interface HttpError extends Error {
  status?: number;
}

/**
 * Final error-handling middleware. Keep this last in the middleware chain
 * (see src/app.ts). Logs a structured JSON line so Datadog Agent log
 * collection can pick it up and correlate it with the active APM trace.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status ?? 500;

  logger.error(err.message, { status, path: req.path, method: req.method });

  res.status(status).json({
    error: {
      message: status === 500 ? "Internal server error" : err.message,
    },
  });
}
