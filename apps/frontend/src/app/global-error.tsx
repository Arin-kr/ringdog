"use client";

import { useEffect } from "react";
import { addNextjsError } from "@datadog/browser-rum-nextjs";

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

  return (
    <html>
      <body>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
