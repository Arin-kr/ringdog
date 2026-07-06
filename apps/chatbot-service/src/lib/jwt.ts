import jwt from "jsonwebtoken";
import { AuthTokenPayload } from "@ringdog/shared";

import { env } from "../config/env";

/**
 * Tiny local copy of backend-api's JWT verification logic.
 *
 * Intentionally duplicated (rather than importing from
 * `@ringdog/backend-api`) to keep this service independently deployable —
 * it only needs read-only verification, not the full auth stack.
 *
 * Returns `undefined` when there is no/invalid token, since JWT is optional
 * here (FR-CHAT-001: unauthenticated users can still chat).
 */
export function tryGetUserIdFromAuthHeader(authHeader: string | undefined): string | undefined {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    return payload.userId;
  } catch {
    return undefined;
  }
}
