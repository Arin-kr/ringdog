import { datadogRum } from "@datadog/browser-rum";

/**
 * RUM Operations Monitoring: each name is one customer-facing journey step,
 * reported as start → succeed/fail (@operation.name / .status /
 * .failure_reason, plus the rum.measure.operation* metrics kept 15 months).
 * Names allow only letters, digits and - _ . @ $ (no spaces).
 * An operation that never ends (tab closed mid-checkout) is closed by Datadog
 * as failed with failure_reason:timeout when the session expires.
 */
export const RUM_OPERATIONS = {
  login: "login",
  addToCart: "add_to_cart",
  checkout: "checkout",
} as const;

export type RumOperationName = (typeof RUM_OPERATIONS)[keyof typeof RUM_OPERATIONS];

interface TrackOptions {
  /** Distinguishes parallel runs of the same operation (e.g. per product). */
  operationKey?: string;
}

/** Runs fn as one operation: succeed on resolve, fail("error") on throw (rethrown). */
export async function trackOperation<T>(
  name: RumOperationName,
  fn: () => Promise<T>,
  options: TrackOptions = {},
): Promise<T> {
  const { operationKey } = options;
  datadogRum.startOperation(name, { operationKey });
  try {
    const result = await fn();
    datadogRum.succeedOperation(name, { operationKey });
    return result;
  } catch (err) {
    datadogRum.failOperation(name, "error", {
      operationKey,
      description: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Records an attempt that was blocked before any request (e.g. a guest
 * clicking add-to-cart). Needs its own start: Datadog drops a fail without one.
 */
export function blockOperation(name: RumOperationName, description: string, options: TrackOptions = {}): void {
  const { operationKey } = options;
  datadogRum.startOperation(name, { operationKey });
  datadogRum.failOperation(name, "other", { operationKey, description });
}

/** Closes an in-flight operation the user walked away from (left the page). */
export function abandonOperation(name: RumOperationName, options: TrackOptions = {}): void {
  datadogRum.failOperation(name, "abandoned", { operationKey: options.operationKey });
}
