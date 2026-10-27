import { beforeEach, describe, expect, it, vi } from "vitest";

const { startOperation, succeedOperation, failOperation } = vi.hoisted(() => ({
  startOperation: vi.fn(),
  succeedOperation: vi.fn(),
  failOperation: vi.fn(),
}));
vi.mock("@datadog/browser-rum", () => ({
  datadogRum: { startOperation, succeedOperation, failOperation },
}));

import { abandonOperation, blockOperation, RUM_OPERATIONS, trackOperation } from "./rumOperations";

describe("rumOperations", () => {
  beforeEach(() => {
    startOperation.mockClear();
    succeedOperation.mockClear();
    failOperation.mockClear();
  });

  it("uses names Datadog accepts (letters, digits, - _ . @ $)", () => {
    for (const name of Object.values(RUM_OPERATIONS)) {
      expect(name).toMatch(/^[A-Za-z0-9\-_.@$]+$/);
    }
  });

  it("starts then succeeds and returns the result", async () => {
    const result = await trackOperation(RUM_OPERATIONS.checkout, async () => 42);
    expect(result).toBe(42);
    expect(startOperation).toHaveBeenCalledWith("checkout", { operationKey: undefined });
    expect(succeedOperation).toHaveBeenCalledWith("checkout", { operationKey: undefined });
    expect(failOperation).not.toHaveBeenCalled();
  });

  it("fails with reason error and rethrows", async () => {
    await expect(
      trackOperation(RUM_OPERATIONS.addToCart, async () => { throw new Error("boom"); }, { operationKey: "p1" }),
    ).rejects.toThrow("boom");
    expect(startOperation).toHaveBeenCalledWith("add_to_cart", { operationKey: "p1" });
    expect(failOperation).toHaveBeenCalledWith("add_to_cart", "error", { operationKey: "p1", description: "boom" });
    expect(succeedOperation).not.toHaveBeenCalled();
  });

  it("records a blocked attempt as start + fail(other)", () => {
    blockOperation(RUM_OPERATIONS.addToCart, "login_required", { operationKey: "p1" });
    expect(startOperation).toHaveBeenCalledWith("add_to_cart", { operationKey: "p1" });
    expect(failOperation).toHaveBeenCalledWith("add_to_cart", "other", { operationKey: "p1", description: "login_required" });
  });

  it("closes an abandoned operation", () => {
    abandonOperation(RUM_OPERATIONS.checkout);
    expect(failOperation).toHaveBeenCalledWith("checkout", "abandoned", { operationKey: undefined });
  });
});
