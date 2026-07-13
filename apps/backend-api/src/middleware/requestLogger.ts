import { NextFunction, Request, Response } from "express";
import { logger } from "@ringdog/shared";

/**
 * Access log for every request. Keep this early in the middleware chain (see
 * src/app.ts) so it wraps the whole request, including ones later handlers
 * pass to errorHandler. Skips /health — hit every few seconds by k8s probes
 * and adds no signal.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health") {
    next();
    return;
  }

  const start = Date.now();

  res.on("finish", () => {
    const fields = {
      method: req.method,
      // req.path gets truncated by Express's sub-router mounting and is
      // never restored for handlers that respond directly instead of
      // calling next() — req.originalUrl stays correct for the whole
      // request lifecycle regardless.
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    };

    if (res.statusCode >= 500) {
      logger.error("Request completed", fields);
    } else if (res.statusCode >= 400) {
      logger.warn("Request completed", fields);
    } else {
      logger.info("Request completed", fields);
    }
  });

  next();
}
