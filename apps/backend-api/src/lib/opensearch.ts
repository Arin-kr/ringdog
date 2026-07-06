import { Client } from "@opensearch-project/opensearch";

import { env } from "../config/env";

/**
 * Thin OpenSearch client wrapper.
 *
 * TODO(M2): wire this up to `src/routes/products.ts`'s search endpoint and
 * to the OpenSearch indexer consumer that reacts to
 * `KAFKA_TOPICS.CATALOG` (ProductUpdated) events per PRD `sync_strategy`.
 * For now `routes/products.ts` falls back to a Prisma `contains` query so
 * the search endpoint actually works end-to-end in this skeleton stage.
 */
export const opensearchClient = new Client({
  node: env.opensearchNode,
});

export async function searchProducts(_query: string): Promise<never> {
  throw new Error("not implemented - see M2");
}

export const OPENSEARCH_PRODUCTS_INDEX = env.opensearchIndexProducts;
