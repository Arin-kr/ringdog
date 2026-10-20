import { describe, expect, it } from "vitest";

import { carouselEdges, carouselStep } from "./carousel";

describe("carouselEdges", () => {
  it("hides both buttons when everything fits", () => {
    expect(carouselEdges({ scrollLeft: 0, clientWidth: 600, scrollWidth: 600 })).toEqual({
      canPrev: false,
      canNext: false,
    });
  });

  it("enables only next at the start", () => {
    expect(carouselEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 })).toEqual({
      canPrev: false,
      canNext: true,
    });
  });

  it("enables only prev at the end, tolerating sub-pixel scroll positions", () => {
    expect(carouselEdges({ scrollLeft: 599.5, clientWidth: 300, scrollWidth: 900 })).toEqual({
      canPrev: true,
      canNext: false,
    });
  });

  it("enables both in the middle", () => {
    expect(carouselEdges({ scrollLeft: 200, clientWidth: 300, scrollWidth: 900 })).toEqual({
      canPrev: true,
      canNext: true,
    });
  });
});

describe("carouselStep", () => {
  it("moves most of a viewport so one card stays visible for context", () => {
    expect(carouselStep(300)).toBe(240);
  });
});
