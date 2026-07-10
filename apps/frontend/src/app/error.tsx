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

  return <button onClick={reset}>Try again</button>;
}
