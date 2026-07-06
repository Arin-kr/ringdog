import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthTokenPayload } from "@ringdog/shared";

import { env } from "../config/env";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches
 * `req.userId` / `req.userEmail`. Responds 401 when the header is missing or
 * the token is invalid/expired (FR-AUTH-002).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: { message: "Missing or invalid Authorization header" } });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: { message: "Invalid or expired token" } });
  }
}
