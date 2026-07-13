import { logger } from "@ringdog/shared";

import { syncAllProductsToOpenSearch } from "../lib/opensearch";

/**
 * Background tasks run once at process start (non-blocking for the HTTP listener).
 */
export function runStartupTasks(): void {
  void (async () => {
    try {
      const count = await syncAllProductsToOpenSearch();
      logger.info("OpenSearch product sync complete", { indexed: count });
    } catch (err) {
      // OpenSearch may be unavailable in some local setups — log and continue.
      logger.warn("OpenSearch sync skipped", { error: String(err) });
    }
  })();
}
