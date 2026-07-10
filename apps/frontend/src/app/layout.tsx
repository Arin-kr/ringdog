import type { Metadata } from "next";
import { DatadogAppRouter } from "@datadog/browser-rum-nextjs";

import { ChatWidget } from "@/components/ChatWidget";
import { RumInit } from "@/components/RumInit";

import "./globals.css";

export const metadata: Metadata = {
  title: "RingDog",
  description: "RingDog — a Datadog observability demo keyring/keychain store.",
};

// Without this, the root layout has no dynamic APIs in its render path, so
// Next.js statically prerenders it once at `next build` time (inside the
// Docker build, before DD_RUM_*/DD_ENV/DD_SITE exist) and reuses that cached
// HTML for every request — baking in "undefined" for all of them forever.
// Forcing dynamic rendering makes process.env reads here happen per-request
// instead, against the pod's actual runtime env.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <RumInit
          applicationId={process.env.DD_RUM_APPLICATION_ID}
          clientToken={process.env.DD_RUM_CLIENT_TOKEN}
          site={process.env.DD_SITE}
          env={process.env.DD_ENV}
        />
        <DatadogAppRouter />
        {children}
        {/* FR-CHAT-001: the chat widget floats on every page. */}
        <ChatWidget />
      </body>
    </html>
  );
}
