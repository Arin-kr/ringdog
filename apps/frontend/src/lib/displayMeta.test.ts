import { describe, expect, it } from "vitest";
import { displayMeta, formatWon, reviewsFor } from "./displayMeta";

describe("displayMeta", () => {
  it("is deterministic per id", () => expect(displayMeta("p1", 8400)).toEqual(displayMeta("p1", 8400)));
  it("keeps values in range over many ids", () => {
    for (let i = 0; i < 500; i++) {
      const m = displayMeta(`id-${i}`, 8400);
      expect([0, 5, 10, 15, 20, 25, 30, 40, 50]).toContain(m.discountRate);
      expect(m.rating).toBeGreaterThanOrEqual(4.0); expect(m.rating).toBeLessThanOrEqual(5.0);
      expect(m.reviewCount).toBeGreaterThanOrEqual(10); expect(m.reviewCount).toBeLessThanOrEqual(500);
      expect(m.originalPrice % 100).toBe(0);
      expect(m.originalPrice).toBeGreaterThanOrEqual(8400);
    }
  });
  it("original equals price when there is no discount", () => {
    const id = Array.from({ length: 500 }, (_, i) => `id-${i}`).find((x) => displayMeta(x, 8400).discountRate === 0)!;
    expect(displayMeta(id, 8400).originalPrice).toBe(8400);
  });
  it("derives original price from sale price", () => {
    const id = Array.from({ length: 500 }, (_, i) => `id-${i}`).find((x) => displayMeta(x, 7000).discountRate === 30)!;
    expect(displayMeta(id, 7000).originalPrice).toBe(10000);
  });
});
describe("reviewsFor", () => {
  it("returns masked authors and recent dates", () => {
    const r = reviewsFor("p1", 3, new Date("2026-10-21T00:00:00Z"));
    expect(r).toHaveLength(3);
    r.forEach((x) => { expect(x.author).toMatch(/^[a-z]{2,5}\*\*\*$/); expect(x.date >= "2026.09.21").toBe(true); });
  });
});
it("formatWon", () => expect(formatWon(8400)).toBe("8,400원"));
