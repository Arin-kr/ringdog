import { syncAllProductsToOpenSearch } from "../lib/opensearch";

/**
 * Background tasks run once at process start (non-blocking for the HTTP listener).
 */
export function runStartupTasks(): void {
  void (async () => {
    try {
      const count = await syncAllProductsToOpenSearch();
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          level: "info",
          message: "OpenSearch product sync complete",
          indexed: count,
        }),
      );
    } catch (err) {
      // OpenSearch may be unavailable in some local setups — log and continue.
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "OpenSearch sync skipped",
          error: String(err),
        }),
      );
    }
  })();
}
