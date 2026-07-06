import { PrismaClient } from "../generated/client";

declare global {
  // eslint-disable-next-line no-var
  var __ringdogPrisma: PrismaClient | undefined;
}

/** Reuse a single client across hot-reloads / lambda-style cold starts. */
export const prisma = global.__ringdogPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__ringdogPrisma = prisma;
}

export * from "../generated/client";
