"use client";

import { useEffect } from "react";

import { initRum } from "@/lib/datadogRum";

/**
 * Mounted once in the root layout so Datadog RUM initializes as early as
 * possible on every page (FR requires FE observability across the app).
 */
export function RumInit(): null {
  useEffect(() => {
    initRum();
  }, []);

  return null;
}
