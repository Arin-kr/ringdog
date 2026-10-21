import { describe, expect, it } from "vitest";
import { hashString } from "./hash";

describe("hashString", () => {
  it("returns the same value for the same input", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
  });
  it("returns a non-negative integer", () => {
    for (const s of ["", "a", "bulk-12", "세일 키링 #99"]) {
      const h = hashString(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });
  it("differs for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
