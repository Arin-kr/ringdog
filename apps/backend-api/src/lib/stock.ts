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

export interface LockKey {
  id: string;
  createdAt: Date;
}

/**
 * 상품 행을 잠그는 공통 순서: 최신 상품 먼저, 같으면 id(UTF-16 코드 단위) 순.
 * checkout과 inventory-batch가 같은 순서로 잠가야 서로 교착(40P01)되지 않는다. 교착이 나면
 * Postgres가 나중에 기다린 쪽(대개 배치)을 끊어 원인 ② 블로킹이 사라진다. DB 정렬(collation)에
 * 기대지 않도록 양쪽 모두 이 함수로 정렬한다.
 */
export function compareLockOrder(a: LockKey, b: LockKey): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export async function reserveStock(
  tx: StockClient,
  items: { productId: string; quantity: number; createdAt: Date }[],
): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${CHECKOUT_LOCK_TIMEOUT}'`);

  // 동시 결제끼리, 그리고 세일가 반영 배치와도 교착되지 않게 항상 같은 순서로 잠근다.
  const sorted = [...items].sort((a, b) =>
    compareLockOrder({ id: a.productId, createdAt: a.createdAt }, { id: b.productId, createdAt: b.createdAt }),
  );
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
