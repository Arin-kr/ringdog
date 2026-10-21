"use client";

import { useEffect } from "react";
import { addNextjsError } from "@datadog/browser-rum-nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    addNextjsError(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-stone-900">앗, 문제가 발생했어요</h1>
      <p className="text-stone-500">페이지를 불러오는 중 오류가 발생했습니다.</p>
      <button
        onClick={reset}
        className="rounded bg-primary-500 px-5 py-2.5 font-bold text-white transition hover:bg-primary-600"
      >
        Try again
      </button>
    </main>
  );
}
