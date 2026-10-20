import { describe, expect, it, vi } from "vitest";

import { CHECKOUT_LOCK_TIMEOUT, OutOfStockError, StockClient, compareLockOrder, reserveStock } from "./stock";

const OLD = new Date("2026-01-01T00:00:00Z");
const NEW = new Date("2026-02-01T00:00:00Z");

function fakeTx(counts: Record<string, number>) {
  const calls: string[] = [];
  const tx = {
    $executeRawUnsafe: vi.fn(async (sql: string) => {
      calls.push(sql);
      return 0;
    }),
    product: {
      updateMany: vi.fn(async (args: { where: { id: string } }) => {
        calls.push(`update:${args.where.id}`);
        return { count: counts[args.where.id] ?? 1 };
      }),
    },
  };
  return { tx: tx as unknown as StockClient, calls, raw: tx };
}

describe("compareLockOrder", () => {
  it("orders newest first, then by id code units (same order inventory-batch locks in)", () => {
    const keys = [
      { id: "b", createdAt: OLD },
      { id: "Z", createdAt: OLD },
      { id: "a", createdAt: NEW },
      { id: "c", createdAt: OLD },
    ];
    expect([...keys].sort(compareLockOrder).map((k) => k.id)).toEqual(["a", "Z", "b", "c"]);
  });
});

describe("reserveStock", () => {
  it("sets lock_timeout first, then decrements in batch lock order (deadlock-safe with inventory-batch)", async () => {
    const { tx, calls, raw } = fakeTx({});
    await reserveStock(tx, [
      { productId: "a", quantity: 1, createdAt: OLD },
      { productId: "c", quantity: 1, createdAt: OLD },
      { productId: "b", quantity: 2, createdAt: NEW },
    ]);
    expect(calls).toEqual([
      `SET LOCAL lock_timeout = '${CHECKOUT_LOCK_TIMEOUT}'`,
      "update:b",
      "update:a",
      "update:c",
    ]);
    expect(raw.product.updateMany).toHaveBeenCalledWith({
      where: { id: "b", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
  });

  it("throws a 409 OutOfStockError when a row has too little stock", async () => {
    const { tx } = fakeTx({ a: 0 });
    const err = await reserveStock(tx, [{ productId: "a", quantity: 1, createdAt: OLD }]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OutOfStockError);
    expect((err as OutOfStockError).status).toBe(409);
    expect((err as OutOfStockError).productId).toBe("a");
  });
});
