import { describe, expect, it } from "vitest";

import { hasMore, mergeProducts } from "./paging";

describe("paging", () => {
  it("mergeProducts drops duplicates and keeps order", () =>
    expect(mergeProducts([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]).map((p) => p.id)).toEqual(["a", "b", "c"]));
  it("hasMore", () => {
    expect(hasMore(24, 1200)).toBe(true);
    expect(hasMore(1200, 1200)).toBe(false);
    expect(hasMore(0, 0)).toBe(false);
  });
});
