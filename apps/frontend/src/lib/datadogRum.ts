import { datadogRum } from "@datadog/browser-rum";
import { nextjsPlugin } from "@datadog/browser-rum-nextjs";

export interface RumConfig {
  applicationId?: string;
  clientToken?: string;
  site?: string;
  env?: string;
  remoteConfigurationId?: string;
}

/**
 * Initializes Datadog RUM (+ RUM-APM trace correlation per NFR-OBS-001) only
 * when the required credentials are configured. No-op otherwise so local dev
 * without Datadog credentials still works.
 *
 * applicationId/clientToken/site/env are passed in (read server-side from
 * plain, non-NEXT_PUBLIC_ env vars by the root layout) rather than read
 * directly from process.env here: NEXT_PUBLIC_* vars get inlined into the
 * client bundle at `next build` time, which for the deployed image happens
 * before these values exist in CI (see apiClient.ts for the same lesson
 * learned the hard way with NEXT_PUBLIC_API_BASE_URL).
 */
let initialized = false;

export function initRum(config: RumConfig): void {
  const { applicationId, clientToken, site, env, remoteConfigurationId } = config;

  // Called from RumInit's render: skip SSR and re-renders.
  if (typeof window === "undefined" || initialized || !applicationId || !clientToken) {
    return;
  }
  initialized = true;

  datadogRum.init({
    applicationId,
    clientToken,
    // Lets Datadog's RUM UI override sample rates etc. without a redeploy
    // (needs browser SDK >= 7.13.0). Omitted when unset, e.g. local dev.
    ...(remoteConfigurationId ? { remoteConfiguration: { id: remoteConfigurationId } } : {}),
    site: site ?? "datadoghq.com",
    service: "ringdog-frontend",
    env: env ?? "local",
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    // Browser profiling (SDK >= 6.12); needs the Document-Policy: js-profiling
    // response header from next.config.js, or the profiler fails to start.
    profilingSampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "allow",
    // Correlates RUM traces with backend-api / chatbot-service APM traces
    // via the x-datadog-trace-id header (NFR-OBS-001). Requests to backend-api
    // / chatbot-service go through the same ALB origin as the frontend (see
    // apiClient.ts), so the browser's resolved request URL is always this
    // page's own origin regardless of environment.
    allowedTracingUrls: [
      process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin,
      process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL || window.location.origin,
    ],
    // Required for the App Router: without it, RUM can't attribute views to
    // Next.js routes (client-side navigations would all merge into one view).
    plugins: [nextjsPlugin()],
  });
}

/**
 * Tags the RUM session with the logged-in member (usr.id) or clears it, so
 * visitors split into members vs. guests; the SDK's anonymous id (usr.
 * anonymous_id) stays on both. Called on init with the stored token too:
 * a returning visitor (or k6 browser, which injects the token into
 * localStorage) never passes through the login form. Only the user id is
 * sent, never the email. The token isn't verified here; it's just a label.
 */
export function setRumUserFromToken(token: string | null): void {
  const userId = token ? userIdFromToken(token) : null;
  if (userId) {
    datadogRum.setUser({ id: userId });
  } else {
    datadogRum.clearUser();
  }
}

function userIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { userId } = JSON.parse(json) as { userId?: unknown };
    return typeof userId === "string" && userId ? userId : null;
  } catch {
    return null;
  }
}
