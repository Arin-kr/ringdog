"use client";

import { useEffect } from "react";
import { addNextjsError } from "@datadog/browser-rum-nextjs";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    addNextjsError(error);
  }, [error]);

  // This replaces the entire root layout (including <html>/<body>), so it
  // never gets the font CSS variables layout.tsx sets — Tailwind's
  // fontFamily.sans fallback (defaultTheme.fontFamily.sans) is what actually
  // renders here, not Noto Sans KR. Acceptable for this rare full-app-crash
  // screen.
  return (
    <html lang="ko">
      <body className="flex min-h-screen items-center justify-center bg-cream font-sans text-stone-800">
        <main className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <h1 className="font-heading text-2xl">앗, 문제가 발생했어요</h1>
          <p className="text-stone-500">애플리케이션에 심각한 오류가 발생했습니다.</p>
          <button
            onClick={reset}
            className="rounded-full bg-primary-500 px-4 py-2.5 font-medium text-white transition hover:bg-primary-600"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
