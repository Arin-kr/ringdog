import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTrending, TrendingItem } from "./trending";

const item: TrendingItem = { id: "p1", name: "별 키링", price: 4550, imageUrl: null, tags: ["미니", "별"], sold: 12 };

describe("loadTrending", () => {
  afterEach(() => vi.useRealTimers());

  it("is ready when enabled with items", async () => {
    await expect(loadTrending(async () => ({ enabled: true, items: [item] }))).resolves.toEqual({
      status: "ready",
      items: [item],
    });
  });

  it("hides when the flag is off", async () => {
    await expect(loadTrending(async () => ({ enabled: false, items: [] }))).resolves.toEqual({ status: "hidden" });
  });

  it("hides when enabled but nothing sold recently", async () => {
    await expect(loadTrending(async () => ({ enabled: true, items: [] }))).resolves.toEqual({ status: "hidden" });
  });

  it("hides (no error) when the API fails", async () => {
    await expect(loadTrending(async () => Promise.reject(new Error("500")))).resolves.toEqual({ status: "hidden" });
  });

  it("hides (no error) when the API is slower than the timeout", async () => {
    vi.useFakeTimers();
    const slow = (_path: string, init: { signal: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const result = loadTrending(slow, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toEqual({ status: "hidden" });
  });
});
