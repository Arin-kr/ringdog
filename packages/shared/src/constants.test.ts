import { describe, expect, it } from "vitest";

import { DEMO_COUPON_CODE } from "./constants";

describe("constants", () => {
  it("exposes the demo coupon code from PRD", () => {
    expect(DEMO_COUPON_CODE).toBe("RINGDOG100");
  });
});
