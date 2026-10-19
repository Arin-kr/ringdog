import type { Prisma } from "@ringdog/db";

export type StockClient = Pick<Prisma.TransactionClient, "$executeRawUnsafe" | "product">;

/**
 * 다른 트랜잭션(예: 세일가 반영 배치)이 상품 행을 오래 잡고 있어도 결제 요청이
 * 커넥션을 무한정 붙잡지 않도록 대기 상한을 둔다. 상한을 넘으면 Postgres가
 * "canceling statement due to lock timeout"(55P03)으로 끊고 500이 된다.
 */
export const CHECKOUT_LOCK_TIMEOUT = "5s";

export class OutOfStockError extends Error {
  readonly status = 409;

  constructor(readonly productId: string) {
    super("Out of stock");
    this.name = "OutOfStockError";
  }
}

export async function reserveStock(
  tx: StockClient,
  items: { productId: string; quantity: number }[],
): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${CHECKOUT_LOCK_TIMEOUT}'`);

  // 항상 같은 순서로 잠가서 동시 결제끼리 교착되지 않게 한다.
  const sorted = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
  for (const item of sorted) {
    const { count } = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (count === 0) {
      throw new OutOfStockError(item.productId);
    }
  }
}
