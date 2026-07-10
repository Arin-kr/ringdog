import { datadogRum } from "@datadog/browser-rum";

/**
 * Initializes Datadog RUM (+ RUM-APM trace correlation per
 * NFR-OBS-001) only when the required public env vars are configured.
 * No-op otherwise so local dev without Datadog credentials still works.
 */
export function initRum(): void {
  const applicationId = process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID;
  const clientToken = process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN;

  if (!applicationId || !clientToken) {
    return;
  }

  datadogRum.init({
    applicationId,
    clientToken,
    site: process.env.NEXT_PUBLIC_DD_SITE ?? "datadoghq.com",
    service: "ringdog-frontend",
    env: process.env.NEXT_PUBLIC_DD_ENV ?? "local",
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input",
    // Correlates RUM traces with backend-api / chatbot-service APM traces
    // via the x-datadog-trace-id header (NFR-OBS-001). Requests to backend-api
    // / chatbot-service go through the same ALB origin as the frontend (see
    // apiClient.ts), so the browser's resolved request URL is always this
    // page's own origin regardless of environment.
    allowedTracingUrls: [
      process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin,
      process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL || window.location.origin,
    ],
  });
}
