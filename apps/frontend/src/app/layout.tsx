import type { Metadata } from "next";

import { ChatWidget } from "@/components/ChatWidget";
import { RumInit } from "@/components/RumInit";

import "./globals.css";

export const metadata: Metadata = {
  title: "RingDog",
  description: "RingDog — a Datadog observability demo keyring/keychain store.",
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <RumInit />
        {children}
        {/* FR-CHAT-001: the chat widget floats on every page. */}
        <ChatWidget />
      </body>
    </html>
  );
}
