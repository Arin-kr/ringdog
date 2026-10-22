import { describe, expect, it } from "vitest";

import { buildSearchBody, parseTagQuery } from "./searchQuery";

describe("parseTagQuery", () => {
  it("returns the tag for #-prefixed queries", () => {
    expect(parseTagQuery("#동물")).toBe("동물");
    expect(parseTagQuery("  # 동물 ")).toBe("동물");
  });
  it("returns null for plain text or a bare #", () => {
    expect(parseTagQuery("동물")).toBeNull();
    expect(parseTagQuery("#")).toBeNull();
    expect(parseTagQuery("")).toBeNull();
  });
});

describe("buildSearchBody", () => {
  it("uses an exact tag term query for #-prefixed queries", () => {
    const body = buildSearchBody("#동물", 24, 24);
    expect(body.query).toEqual({ term: { tags: "동물" } });
    expect(body.from).toBe(24);
    expect(body.size).toBe(24);
  });
  it("keeps full-text matching for plain queries", () => {
    const body = buildSearchBody("고양이", 0, 24);
    expect(JSON.stringify(body.query)).toContain('"fuzziness":"AUTO"');
  });
  it("matches everything for an empty query", () => {
    expect(buildSearchBody("  ", 0, 24).query).toEqual({ match_all: {} });
  });
});
