import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryForTags, categorySearchHref, subjectSearchHref, tagSearchHref } from "./categories";
import { SUBJECT_IMAGES } from "./productImage";

describe("categories", () => {
  it("every subject tag maps to at most one category", () => {
    const all = CATEGORIES.flatMap((c) => c.subjects);
    expect(new Set(all).size).toBe(all.length);
    for (const s of all) expect(Object.keys(SUBJECT_IMAGES)).toContain(s);
  });
  it("has no vehicles category", () => {
    expect(CATEGORIES.map((c) => c.label)).not.toContain("탈것");
  });
  it("has unique slugs and images from the subject pool", () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) expect(SUBJECT_IMAGES[c.subjects[0]][0]).toBe(c.image);
  });
  it("finds category from its label tag", () => {
    const found = categoryForTags(["가죽", "고양이", "동물"]);
    expect(found?.category.label).toBe("동물");
    expect(found?.subject).toBe("고양이");
  });
  it("returns null without a category label tag", () => {
    expect(categoryForTags(["가죽", "고양이"])).toBeNull();
    expect(categoryForTags(["미니", "별"])).toBeNull();
    expect(categoryForTags(["가죽", "자동차"])).toBeNull();
    expect(categoryForTags([])).toBeNull();
  });
  it("builds #tag search hrefs", () => {
    expect(tagSearchHref("동물")).toBe(`/?q=${encodeURIComponent("#동물")}`);
    expect(subjectSearchHref("고양이")).toBe(`/?q=${encodeURIComponent("#고양이")}`);
    const animals = CATEGORIES.find((c) => c.slug === "animals")!;
    expect(categorySearchHref(animals)).toBe(`/?q=${encodeURIComponent("#동물")}`);
  });
});
