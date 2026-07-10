"use client";

import { useEffect } from "react";

import { initRum, type RumConfig } from "@/lib/datadogRum";

/**
 * Mounted once in the root layout so Datadog RUM initializes as early as
 * possible on every page (FR requires FE observability across the app).
 * Config is passed down from the (server-side) root layout — see
 * datadogRum.ts for why these aren't read directly from process.env here.
 */
export function RumInit(props: RumConfig): null {
  useEffect(() => {
    initRum(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
