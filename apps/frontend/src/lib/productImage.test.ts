import { describe, expect, it } from "vitest";
import { ALL_PRODUCT_IMAGES, BANNER_IMAGES, SUBJECT_IMAGES, productImages } from "./productImage";

describe("productImages", () => {
  it("uses imageUrl when present", () => {
    expect(productImages({ id: "a", name: "x", tags: ["가죽", "고양이"], imageUrl: "https://x/y.jpg" })).toEqual(["https://x/y.jpg"]);
  });
  it("picks from the subject pool by tag", () => {
    const [img] = productImages({ id: "a", name: "가죽 고양이 키링 #2", tags: ["가죽", "고양이"], imageUrl: null });
    expect(SUBJECT_IMAGES["고양이"]).toContain(img);
  });
  it("is deterministic per id", () => {
    const p = { id: "abc", name: "n", tags: ["별"], imageUrl: null };
    expect(productImages(p, 3)).toEqual(productImages(p, 3));
  });
  it("spreads bulk sale products across the whole pool", () => {
    const imgs = new Set(Array.from({ length: 40 }, (_, i) =>
      productImages({ id: `bulk-${i}`, name: `세일 키링 #${60 + i}`, tags: ["미니", "별"], imageUrl: null })[0]));
    expect(imgs.size).toBeGreaterThanOrEqual(8);
  });
  it("falls back to the whole pool for unknown or empty tags", () => {
    expect(ALL_PRODUCT_IMAGES).toContain(productImages({ id: "z", name: "n", tags: [], imageUrl: null })[0]);
  });
  it("returns count distinct images when the pool allows", () => {
    expect(new Set(productImages({ id: "q", name: "n", tags: ["고양이"], imageUrl: null }, 4)).size).toBe(4);
  });
  it("covers all 15 subjects and 3 banners", () => {
    expect(Object.keys(SUBJECT_IMAGES)).toHaveLength(15);
    expect(BANNER_IMAGES).toHaveLength(3);
  });
});
