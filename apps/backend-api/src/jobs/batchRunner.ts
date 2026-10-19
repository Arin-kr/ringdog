/**
 * 시나리오 ① "타임세일 가격·재고 반영 배치" (원인 ②)의 처리 순서. DB 접근은 deps로 주입한다.
 *
 * - fault(장애 모드): 상품 전체를 트랜잭션 하나로 묶고 상품당 1.5초씩 천천히 처리(1,200개에 약 30분), 커밋은 마지막 1회.
 *   처리한 행의 락을 끝날 때까지 쥐고 있어 그 상품의 checkout 재고 차감이 기다린다.
 * - safe(안전 모드): 2차 대처 Workflow가 세션 종료 직후 자동 실행. 50개씩 바로 커밋 + lock_timeout 2s.
 */
export type BatchMode = "fault" | "safe";

export interface BatchTarget {
  id: string;
  price: number;
  stock: number;
}

export type UpdateFn = (target: BatchTarget) => Promise<void>;

export interface BatchDeps {
  /** fn 안의 update는 모두 한 트랜잭션. fn이 끝나면 커밋. */
  transaction(fn: (update: UpdateFn) => Promise<void>): Promise<void>;
  sleep(ms: number): Promise<void>;
  log(message: string, fields?: Record<string, unknown>): void;
}

export const SAFE_CHUNK_SIZE = 50;
export const FAULT_ITEM_DELAY_MS = 1500;
export const PROGRESS_EVERY = 25;
export const SAFE_MAX_ATTEMPTS = 3;
export const SALE_STOCK = 100000;

export function salePrice(price: number): number {
  return Math.round((price * 0.7) / 10) * 10;
}

function count(n: number): string {
  return n.toLocaleString("en-US");
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function runBatch(mode: BatchMode, targets: BatchTarget[], deps: BatchDeps): Promise<void> {
  const total = targets.length;
  const fault = mode === "fault";
  // 장애 모드 시작 로그는 원인을 암시하지 않는다 (청중이 로그에서 배치를 스스로 찾아내야 한다). 모드는 구조화 필드에만 남긴다.
  deps.log(
    fault
      ? `세일가 반영 시작: 대상 ${count(total)}개`
      : `세일가 반영 시작: 대상 ${count(total)}개 (안전 모드: ${SAFE_CHUNK_SIZE}개씩 커밋)`,
    { mode, total },
  );

  let done = 0;
  for (const chunk of chunks(targets, fault ? total : SAFE_CHUNK_SIZE)) {
    const maxAttempts = fault ? 1 : SAFE_MAX_ATTEMPTS;
    for (let attempt = 1; ; attempt++) {
      let doneInChunk = 0;
      try {
        await deps.transaction(async (update) => {
          for (const target of chunk) {
            await update(target);
            doneInChunk++;
            if (fault) {
              const progress = done + doneInChunk;
              if (progress % PROGRESS_EVERY === 0) {
                deps.log(`세일가 반영 ${count(progress)}/${count(total)} 처리 중`, { mode, done: progress, total });
              }
              await deps.sleep(FAULT_ITEM_DELAY_MS);
            }
          }
        });
        break;
      } catch (err) {
        if (attempt >= maxAttempts) throw err;
        deps.log(`세일가 반영 재시도 ${attempt}/${maxAttempts - 1}: ${(err as Error).message}`, { mode, attempt });
        await deps.sleep(1000);
      }
    }
    done += chunk.length;
    if (!fault) {
      deps.log(`세일가 반영 ${count(done)}/${count(total)} 커밋`, { mode, done, total });
    }
  }

  deps.log(`세일가 반영 완료: ${count(done)}/${count(total)}`, { mode, done, total });
}
