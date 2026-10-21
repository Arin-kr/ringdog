import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryForTags, categorySearchHref, subjectSearchHref } from "./categories";
import { SUBJECT_IMAGES } from "./productImage";

describe("categories", () => {
  it("every subject tag maps to exactly one category", () => {
    const all = CATEGORIES.flatMap((c) => c.subjects);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(Object.keys(SUBJECT_IMAGES).sort());
  });
  it("has unique slugs and images from the subject pool", () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) expect(SUBJECT_IMAGES[c.subjects[0]][0]).toBe(c.image);
  });
  it("finds category from tags", () => expect(categoryForTags(["가죽", "고양이"])?.subject).toBe("고양이"));
  it("returns null for unknown tags", () => {
    expect(categoryForTags(["미니"])).toBeNull();
    expect(categoryForTags(["constructor"])).toBeNull();
    expect(categoryForTags([])).toBeNull();
  });
  it("builds search hrefs", () => {
    expect(subjectSearchHref("고양이")).toBe(`/?q=${encodeURIComponent("고양이")}`);
    const animals = CATEGORIES.find((c) => c.slug === "animals")!;
    expect(categorySearchHref(animals)).toBe(`/?q=${encodeURIComponent("고양이 강아지 곰돌이")}`);
  });
});
