import { datadogRum } from "@datadog/browser-rum";
import { nextjsPlugin } from "@datadog/browser-rum-nextjs";

export interface RumConfig {
  applicationId?: string;
  clientToken?: string;
  site?: string;
  env?: string;
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
export function initRum(config: RumConfig): void {
  const { applicationId, clientToken, site, env } = config;

  if (!applicationId || !clientToken) {
    return;
  }

  datadogRum.init({
    applicationId,
    clientToken,
    site: site ?? "datadoghq.com",
    service: "ringdog-frontend",
    env: env ?? "local",
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
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
