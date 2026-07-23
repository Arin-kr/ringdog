import { describe, expect, it } from "vitest";

import { calculateOrderTotal } from "./orderTotal";

describe("calculateOrderTotal", () => {
  it("sums price * quantity across multiple items for the subtotal", () => {
    const result = calculateOrderTotal(
      [
        { price: 10000, quantity: 2 },
        { price: 5000, quantity: 1 },
      ],
      undefined,
    );
    expect(result.subtotal).toBe(25000);
  });

  it("zeroes the total when the demo coupon code is used", () => {
    const result = calculateOrderTotal([{ price: 10000, quantity: 3 }], "RINGDOG100");
    expect(result.subtotal).toBe(30000);
    expect(result.totalAmount).toBe(0);
    expect(result.isDemoCoupon).toBe(true);
  });

  it("leaves the total equal to the subtotal for a non-demo coupon code", () => {
    const result = calculateOrderTotal([{ price: 10000, quantity: 1 }], "SOMEOTHERCODE");
    expect(result.totalAmount).toBe(10000);
    expect(result.isDemoCoupon).toBe(false);
  });

  it("handles a single-item cart with no coupon", () => {
    const result = calculateOrderTotal([{ price: 4999, quantity: 1 }], undefined);
    expect(result.subtotal).toBe(4999);
    expect(result.totalAmount).toBe(4999);
    expect(result.isDemoCoupon).toBe(false);
  });
});
