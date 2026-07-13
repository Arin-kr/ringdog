import { Router } from "express";
import { prisma } from "@ringdog/db";
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, logger } from "@ringdog/shared";

import { searchProducts as opensearchSearch } from "../lib/opensearch";

export const productsRouter: Router = Router();

function parsePagination(query: Record<string, unknown>): { page: number; limit: number } {
  const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_PAGE_LIMIT));
  return { page, limit };
}

/** GET /api/products — FR-CAT-001 */
productsRouter.get("/", async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const sort = typeof req.query.sort === "string" ? req.query.sort : "latest";

    // Only "latest" (createdAt desc) is meaningful with the current schema.
    // TODO(M2): add a "popular" sort once order/sales aggregates exist.
    const orderBy = sort === "latest" ? ({ createdAt: "desc" } as const) : ({ createdAt: "desc" } as const);

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.product.count(),
    ]);

    res.status(200).json({ items, page, limit, total });
  } catch (err) {
    next(err);
  }
});

/** GET /api/products/search — FR-SEARCH-001 (OpenSearch with Prisma fallback) */
productsRouter.get("/search", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);

    try {
      const result = await opensearchSearch(q, page, limit);
      res.status(200).json(result);
      return;
    } catch (searchErr) {
      logger.warn("OpenSearch unavailable, using DB fallback", { error: String(searchErr) });
    }

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { tags: { has: q } },
          ],
        }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({ items, page, limit, total });
  } catch (err) {
    next(err);
  }
});

/** GET /api/products/:id */
productsRouter.get("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) {
      res.status(404).json({ error: { message: "Product not found" } });
      return;
    }
    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
});
