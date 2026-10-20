// IMPORTANT: the tracer must be initialized before any other import (see src/server.ts).
import "../tracer";

import { prisma } from "@ringdog/db";
import { logger } from "@ringdog/shared";

import { compareLockOrder } from "../lib/stock";
import { BatchMode, BatchTarget, SALE_STOCK, runBatch, salePrice } from "./batchRunner";

/**
 * K8s Job `inventory-batch`(장애) / `inventory-batch-safe`(안전) (deploy/demo/inventory-batch-job.yaml)의 진입점.
 * DATABASE_URL에 application_name=inventory-batch가 붙어 있어 DBM·세션 종료 조건에서 이 이름으로 보인다.
 */
const mode: BatchMode = process.env.BATCH_MODE === "safe" ? "safe" : "fault";
const targetCount = Number(process.env.BATCH_TARGET_COUNT ?? "1200");

async function main(): Promise<void> {
  // 목록과 같은 순서(최신순) → k6가 구매하는 앞쪽 상품부터 잠근다.
  // 잠그는 순서는 checkout과 같은 compareLockOrder로 다시 정렬한다 (DB 정렬과 달라 교착이 나지 않게).
  const rows = await prisma.product.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: targetCount,
    select: { id: true, price: true, stock: true, createdAt: true },
  });
  const targets: BatchTarget[] = [...rows]
    .sort(compareLockOrder)
    .map((r) => ({ id: r.id, price: Number(r.price), stock: r.stock }));
  const ids = targets.map((t) => t.id);

  // reset이 정상가로 되돌릴 수 있도록 원래 값을 따로 커밋해 둔다 (이미 있으면 처음 값 유지).
  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS demo_price_backup (product_id text PRIMARY KEY, price numeric(10,2) NOT NULL, stock integer NOT NULL)",
  );
  await prisma.$executeRaw`
    INSERT INTO demo_price_backup (product_id, price, stock)
    SELECT id, price, stock FROM products WHERE id = ANY(${ids}::text[])
    ON CONFLICT (product_id) DO NOTHING`;

  await runBatch(mode, targets, {
    transaction: (fn) =>
      prisma.$transaction(
        async (tx) => {
          if (mode === "safe") {
            await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '2s'");
          }
          await fn(async (t) => {
            await tx.$executeRaw`UPDATE products SET price = ${salePrice(t.price)}, stock = ${SALE_STOCK} WHERE id = ${t.id}`;
          });
        },
        // 장애 모드는 약 30분 동안 트랜잭션을 연다 (Job activeDeadlineSeconds가 상한).
        { maxWait: 10_000, timeout: 40 * 60_000 },
      ),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message, fields) => logger.info(message, { batch: "inventory-batch", ...fields }),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: Error) => {
    logger.error("세일가 반영 중단: 트랜잭션이 롤백되어 반영된 상품이 없습니다", {
      batch: "inventory-batch",
      mode,
      error: { kind: err.name, message: err.message, stack: err.stack },
    });
    await prisma.$disconnect();
    process.exit(1);
  });
