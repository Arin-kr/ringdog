import { Client } from "@opensearch-project/opensearch";
import { Product, PaginatedResult } from "@ringdog/shared";
import { prisma } from "@ringdog/db";

import { env } from "../config/env";

export const OPENSEARCH_PRODUCTS_INDEX = env.opensearchIndexProducts;

export const opensearchClient = new Client({
  node: env.opensearchNode,
});

const PRODUCT_INDEX_MAPPING = {
  mappings: {
    properties: {
      id: { type: "keyword" },
      name: { type: "text", analyzer: "standard" },
      description: { type: "text", analyzer: "standard" },
      price: { type: "float" },
      stock: { type: "integer" },
      tags: { type: "keyword" },
      imageUrl: { type: "keyword", index: false },
      createdAt: { type: "date" },
    },
  },
};

function toProductDoc(product: {
  id: string;
  name: string;
  description: string;
  price: unknown;
  stock: number;
  tags: string[];
  imageUrl: string | null;
  createdAt: Date;
}): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    stock: product.stock,
    tags: product.tags,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt.toISOString(),
  };
}

export async function ensureProductsIndex(): Promise<void> {
  const exists = await opensearchClient.indices.exists({ index: OPENSEARCH_PRODUCTS_INDEX });
  if (!exists.body) {
    await opensearchClient.indices.create({
      index: OPENSEARCH_PRODUCTS_INDEX,
      body: PRODUCT_INDEX_MAPPING,
    });
  }
}

export async function indexProduct(product: {
  id: string;
  name: string;
  description: string;
  price: unknown;
  stock: number;
  tags: string[];
  imageUrl: string | null;
  createdAt: Date;
}): Promise<void> {
  await opensearchClient.index({
    index: OPENSEARCH_PRODUCTS_INDEX,
    id: product.id,
    body: toProductDoc(product),
    refresh: true,
  });
}

/** Bulk-index all products from PostgreSQL into OpenSearch. */
export async function syncAllProductsToOpenSearch(): Promise<number> {
  await ensureProductsIndex();

  const products = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  if (products.length === 0) {
    return 0;
  }

  const body = products.flatMap((product) => [
    { index: { _index: OPENSEARCH_PRODUCTS_INDEX, _id: product.id } },
    toProductDoc(product),
  ]);

  await opensearchClient.bulk({ refresh: true, body });
  return products.length;
}

export async function searchProducts(
  query: string,
  page: number,
  limit: number,
): Promise<PaginatedResult<Product>> {
  await ensureProductsIndex();

  const from = (page - 1) * limit;
  const q = query.trim();

  const searchBody = q
    ? {
        from,
        size: limit,
        query: {
          bool: {
            should: [
              { match: { name: { query: q, fuzziness: "AUTO" } } },
              { match: { description: { query: q } } },
              { terms: { tags: [q] } },
            ],
            minimum_should_match: 1,
          },
        },
        sort: [{ createdAt: { order: "desc" } }],
      }
    : {
        from,
        size: limit,
        query: { match_all: {} },
        sort: [{ createdAt: { order: "desc" } }],
      };

  const response = await opensearchClient.search({
    index: OPENSEARCH_PRODUCTS_INDEX,
    body: searchBody,
  });

  const hits = response.body.hits;
  const total =
    typeof hits.total === "number" ? hits.total : (hits.total?.value ?? 0);

  const items: Product[] = hits.hits.map((hit: { _source?: unknown }) => hit._source as Product);

  return { items, page, limit, total };
}
