import { describe, expect, it, vi } from "vitest";

import { CHECKOUT_LOCK_TIMEOUT, OutOfStockError, StockClient, reserveStock } from "./stock";

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

describe("reserveStock", () => {
  it("sets lock_timeout first, then decrements in productId order (deadlock-safe)", async () => {
    const { tx, calls, raw } = fakeTx({});
    await reserveStock(tx, [
      { productId: "b", quantity: 2 },
      { productId: "a", quantity: 1 },
    ]);
    expect(calls).toEqual([`SET LOCAL lock_timeout = '${CHECKOUT_LOCK_TIMEOUT}'`, "update:a", "update:b"]);
    expect(raw.product.updateMany).toHaveBeenCalledWith({
      where: { id: "b", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
  });

  it("throws a 409 OutOfStockError when a row has too little stock", async () => {
    const { tx } = fakeTx({ a: 0 });
    const err = await reserveStock(tx, [{ productId: "a", quantity: 1 }]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OutOfStockError);
    expect((err as OutOfStockError).status).toBe(409);
    expect((err as OutOfStockError).productId).toBe("a");
  });
});
