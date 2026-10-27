"use client";

import { getToken } from "@/lib/auth";
import { initRum, setRumUserFromToken, type RumConfig } from "@/lib/datadogRum";

/**
 * Mounted once in the root layout so Datadog RUM initializes as early as
 * possible on every page (FR requires FE observability across the app).
 * Config is passed down from the (server-side) root layout — see
 * datadogRum.ts for why these aren't read directly from process.env here.
 *
 * Initializes during render, not in useEffect: <DatadogAppRouter /> (next
 * sibling in layout.tsx) calls startView while rendering, and with the nextjs
 * plugin's trackViewsManually the SDK doesn't start until a startView arrives
 * after init. Deferring init to an effect dropped the initial view, so RUM
 * only started on the first client-side navigation (full page loads, like
 * k6 browser's page.goto, never sent anything). initRum is idempotent and a
 * no-op on the server.
 */
let userSynced = false;

export function RumInit(props: RumConfig): null {
  initRum(props);
  // Once per page load, like init; login/logout update it via auth.ts.
  if (typeof window !== "undefined" && !userSynced) {
    userSynced = true;
    setRumUserFromToken(getToken());
  }
  return null;
}
