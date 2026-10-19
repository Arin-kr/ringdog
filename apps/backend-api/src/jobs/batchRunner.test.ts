import { describe, expect, it, vi } from "vitest";

import { BatchDeps, BatchTarget, SAFE_CHUNK_SIZE, runBatch, salePrice } from "./batchRunner";

const targets: BatchTarget[] = Array.from({ length: 120 }, (_, i) => ({ id: `p${i}`, price: 10000 + i * 10, stock: 30 }));

function fakeDeps(failFirstTransaction = false) {
  const transactions: string[][] = [];
  const logs: string[] = [];
  let failed = false;
  const deps: BatchDeps = {
    transaction: vi.fn(async (fn: Parameters<BatchDeps["transaction"]>[0]) => {
      const updated: string[] = [];
      if (failFirstTransaction && !failed) {
        failed = true;
        throw new Error("canceling statement due to lock timeout");
      }
      await fn(async (t) => {
        updated.push(t.id);
      });
      transactions.push(updated);
    }),
    sleep: vi.fn(async () => undefined),
    log: vi.fn((message: string) => {
      logs.push(message);
    }),
  };
  return { deps, transactions, logs };
}

describe("runBatch", () => {
  it("fault mode: one transaction holding every row, 1.5s pause per item, progress logs", async () => {
    const { deps, transactions, logs } = fakeDeps();
    await runBatch("fault", targets, deps);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toHaveLength(120);
    expect(transactions[0][0]).toBe("p0"); // 목록 순서 그대로 = k6가 사는 상품부터 잠근다
    expect(deps.sleep).toHaveBeenCalledTimes(120);
    expect(logs[0]).toBe("세일가 반영 시작: 대상 120개");
    expect(logs).toContain("세일가 반영 25/120 처리 중");
    expect(logs.at(-1)).toBe("세일가 반영 완료: 120/120");
  });

  it("safe mode: commits every 50 rows without pausing", async () => {
    const { deps, transactions, logs } = fakeDeps();
    await runBatch("safe", targets, deps);
    expect(transactions.map((t) => t.length)).toEqual([SAFE_CHUNK_SIZE, SAFE_CHUNK_SIZE, 20]);
    expect(deps.sleep).not.toHaveBeenCalled();
    expect(logs).toContain("세일가 반영 50/120 커밋");
    expect(logs.at(-1)).toBe("세일가 반영 완료: 120/120");
  });

  it("safe mode retries a chunk that hit lock_timeout", async () => {
    const { deps, transactions } = fakeDeps(true);
    await runBatch("safe", targets, deps);
    expect(deps.transaction).toHaveBeenCalledTimes(4);
    expect(transactions.flat()).toHaveLength(120);
  });

  it("fault mode does not retry (the killed session must stay dead)", async () => {
    const { deps } = fakeDeps(true);
    await expect(runBatch("fault", targets, deps)).rejects.toThrow("lock timeout");
    expect(deps.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("salePrice", () => {
  it("is 30% off rounded to 10 won", () => {
    expect(salePrice(6500)).toBe(4550);
    expect(salePrice(5000)).toBe(3500);
  });
});
