# 데모 시나리오 ① "타임세일 트래픽 폭주 → DB 병목" 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타임세일 트래픽 급증 + 인덱스 없는 인기상품 쿼리 + 세일가 반영 배치의 락이 겹친 장애를 `demo-control inject` 한 번으로 재현하고, Datadog으로 원인 2개를 분리해 원인 ①(위젯 OFF → MCP 인덱스 PR → 인덱스 적용 + 위젯 ON)과 원인 ②(세션 종료 + 배치 안전 모드 재실행)를 Slack 승인으로 차례대로 해결하는 시연 환경을 만든다. 시연자가 하는 일은 5가지(`demo-up` / `inject` / 1차 / 2차 / `reset` 또는 `demo-down`)로 묶는다(설계 3.1). 시나리오 ②와 3단계가 재사용할 데모 공통 기반도 함께 만든다.

**Architecture:** 앱 쪽은 backend-api에 인기상품 API(플래그), checkout 재고 차감(+`lock_timeout`), 세일가 반영 배치 Job 진입점을 추가하고 frontend에 위젯을 넣는다. 인프라는 Terraform(RDS 파라미터 그룹·DBM 계정 시크릿·노드 3대·팀 스택)과 Helm(UST, 리소스 요청값, HPA, 플래그 ConfigMap, LimitRange, k6)으로 구성하고, cd.yml이 metrics-server·DBM 준비·Agent Postgres 체크를 배포한다. 시연 조작은 전부 `demo-control.yml` → `deploy/demo/demo-control.sh` 하나로 모은다. Datadog 모니터·대시보드·Workflow는 실환경 Task에서 만들고 정의를 `datadog/`에 마스킹해 커밋한다.

**Tech Stack:** Node 24 / Express / Prisma 5 / dd-trace 5 / vitest 2, Next.js 15, PostgreSQL 16 (RDS), Helm 3.14+, Terraform ≥1.7 (AWS provider ~>5), GitHub Actions, k6 0.52.0 (`k6/browser`), metrics-server chart 3.12.2, Datadog (APM, Logs, RUM, DBM, Infra, Monitors, Workflow Automation, Bits AI SRE/Chat, MCP)

**Spec:** [`docs/design/specs/2026-10-15-demo-flash-sale-db-design.md`](../specs/2026-10-15-demo-flash-sale-db-design.md)
**진행 현황 문서:** [`docs/demo/01-flash-sale-db/README.md`](../../demo/01-flash-sale-db/README.md) — 각 Task 완료 시 진행 현황 표(B1~B5, F1~F10, R) 갱신

## Global Constraints

- 서비스명: `ringdog-backend-api`, `ringdog-frontend`, `ringdog-chatbot-service`, `ringdog-order-consumer`, 배치 `inventory-batch` / env: `demo`
- 배치 DB 연결 `application_name = 'inventory-batch'`. 세션 종료는 이 이름 + "다른 세션을 막고 있음" + "트랜잭션이 30초 넘게 열려 있음" 세 조건을 모두 만족하는 세션만
- 배치 Job 이름 `inventory-batch`(장애 모드) / `inventory-batch-safe`(안전 모드), `backoffLimit: 0`. 장애 모드: 대상 1,200개, 상품당 1.5초(약 30분), 커밋 1회, 시작 지연 180초, `activeDeadlineSeconds` 2580. 안전 모드: 50개씩 커밋, `lock_timeout` 2초, 지연 0, `activeDeadlineSeconds` 600
  - 구현 중 변경(설계 4.6): 장애 모드 Job 이름은 원인을 드러내지 않도록 `-fault` 없이 `inventory-batch`로 바꿨고, 장애 모드 시작 로그도 모드 힌트 없이 "세일가 반영 시작: 대상 1,200개"로 바꿨다(모드는 로그 `mode` 필드에만). 아래 Task 9 코드 조각의 "(장애 모드: …)" 문구는 이 규칙으로 대체된다
- checkout 재고 차감 트랜잭션 `lock_timeout` 5초
- 위젯 플래그: ConfigMap `ringdog-feature-flags`, 키 `FEATURE_TRENDING_WIDGET`, Helm 값 `featureFlags.trendingWidget`(`"true"`/`"false"`, 기본 `"false"`). 플래그는 backend-api만 읽는다
- 원인 ① 근본 수정 인덱스: `orders(created_at)` = `orders_created_at_idx`, `order_items(order_id)` = `order_items_order_id_idx`. 시연 중 MCP가 만드는 PR(브랜치 `demo/fix-index-<날짜>`)은 **절대 main에 머지하지 않음**. DB에는 `demo-control fix-index`가 같은 인덱스를 `CONCURRENTLY` 없이 직접 만들고(배치의 긴 트랜잭션 때문에 `CONCURRENTLY`는 멈춤), `reset`이 지우고 PR을 닫는다
- 시연자 조작은 5가지: 로컬 `scripts/demo-up.sh` / `demo-control inject` / Workflow 1(승인 2번) / Workflow 2(승인 1번) / `demo-control reset` 또는 로컬 `scripts/demo-down.sh`. Workflow 승인 대기: Workflow 1 첫 승인 10분·두 번째 15분, Workflow 2 30분
- 블로킹 지표: `ringdog.db.blocking_sessions`, `ringdog.db.blocked_sessions` (Postgres 체크 `custom_queries`)
- RDS `db.t3.small`, EKS 노드 `desired 3 / max 4 / min 1`, Cluster Autoscaler 없음
- GitHub OIDC는 `ref:refs/heads/main`만 신뢰 → 모든 데모 워크플로는 main에서 실행
- public repo: AWS 계정 ID, ARN, External ID, Connection ID, Slack 채널 ID, 비밀번호·키를 커밋하지 않음
- 문서는 한국어. 설계/계획 문서는 `docs/design/`
- Windows 개발 PC: `aws`/`terraform`/`helm`/`git push`는 WSL에서 실행. Terraform은 `/mnt/d`가 아닌 WSL 내부 경로 복사본에서 실행 (provider 로딩 timeout 회피)
- `terraform apply`/`destroy`(`demo-up`/`demo-down` 포함), `git push`(main push = cd.yml 실행 = 비용 발생 환경 필요)는 **사용자 확인 후에만**
- Datadog MCP는 현재 다른(고객) org에 연결되어 있을 수 있음 → 실환경 Task 시작 전 `/mcp`로 RingDog org인지 확인. 모니터 생성에는 org의 MCP Write Access가 필요

## Review Focus

1. **세션을 끊은 뒤 장애 모드 배치가 Job 재시도로 다시 떠서 락을 또 잡음** → 재시도 없이 Failed로 끝나야 함 (Task 9 Step 1: 렌더링 테스트가 `backoffLimit: 0` 확인, `mitigate session`이 fault Job도 삭제)
2. **장애 중 인기상품 API가 느리거나 실패** → 위젯은 에러 문구 없이 사라지고 상품 목록은 그대로 보여야 함 (Task 7 Step 1: 타임아웃·실패·비활성 테스트)
3. **k6가 계속 구매해서 재고가 바닥남 / 재고 부족 주문** → 500이 아니라 409, 시드가 재고를 넉넉히 채움 (Task 6 Step 1: `OutOfStockError` 테스트, Task 11 시드 SQL)
4. **새 환경(백업 테이블 없음)에서 `reset`을 실행하거나 `reset`을 두 번 실행** → 오류 없이 끝나야 함 (Task 11 SQL의 `to_regclass` 가드, Task 16 Step 6 확인)
5. **세션 종료가 배치가 아닌 세션(checkout, 수동 psql)까지 끊음** → `inventory-batch`만 끊어야 함 (Task 16 Step 7: 다른 이름의 블로커를 두고 `mitigate session` 실행)

---

## 파일 구조

| 파일 | 상태 | 책임 |
|---|---|---|
| `apps/backend-api/src/lib/orderTotal.ts` (+ test) | cherry-pick `ab519cc` | 주문 합계 순수 함수 (vitest 도입) |
| `apps/backend-api/src/middleware/errorHandler.ts` (+ test) | 수정 | 5xx `error.*` 로그 필드 + span 에러 태그 |
| `apps/backend-api/src/lib/stock.ts` (+ test) | 생성 | checkout 재고 차감 + `lock_timeout`, `OutOfStockError` |
| `apps/backend-api/src/lib/trending.ts` | 생성 | 인기상품 집계 쿼리 (인덱스 없는 원인 ①) |
| `apps/backend-api/src/routes/trending.ts` (+ test) | 생성 | 플래그에 따라 `{enabled, items}` 응답 |
| `apps/backend-api/src/routes/{products,orders}.ts`, `config/env.ts` | 수정 | 라우트 연결, 재고 차감, 플래그 env |
| `apps/backend-api/src/jobs/batchRunner.ts` (+ test) | 생성 | 배치 순서·커밋 단위·진행 로그 (DB 비의존) |
| `apps/backend-api/src/jobs/inventoryBatch.ts` | 생성 | 배치 진입점 (Prisma 연결, 백업 테이블) |
| `apps/frontend/src/lib/trending.ts` (+ test) | 생성 | 위젯 상태 결정 (타임아웃·실패 → 숨김) |
| `apps/frontend/src/components/TrendingWidget.tsx`, `ProductCatalog.tsx` | 생성/수정 | 위젯 표시 |
| `deploy/helm/charts/ringdog/templates/*` | 수정/생성 | UST, 리소스, HPA, 플래그 ConfigMap, LimitRange, k6 |
| `deploy/helm/charts/ringdog/files/traffic/{api.js,browser.js}` | 생성 | k6 스크립트 (평시/급증 프로필) |
| `deploy/helm/charts/ringdog/tests/render-test.sh` | 생성 | Helm 렌더링 회귀 테스트 |
| `deploy/helm/datadog-agent/postgres-values.tmpl.yaml` | 생성 | Postgres DBM cluster check + 블로킹 custom query |
| `deploy/dbm/datadog-setup.sql` | 생성 | `datadog` 계정·스키마·권한·`explain_statement` |
| `deploy/demo/demo-control.sh`, `inventory-batch-job.yaml`, `sql/{bulk-seed,terminate-batch-blockers,apply-index,reset}.sql`, `tests/render-test.sh` | 생성 | 시연 조작 (inject/mitigate/fix-index/reset + seed/start/spike/stop) |
| `scripts/{lib-demo-env,demo-up,demo-down}.sh` | 생성 | 환경 올리기·내리기 한 번에 (WSL) |
| `.github/workflows/cd.yml` | 수정 | 수동 실행, metrics-server, DBM 준비, Agent Postgres 체크, 대량 시드, 평시 트래픽 |
| `.github/workflows/demo-control.yml` | 생성 | `demo-control.sh` 실행 (Datadog Workflow가 호출) |
| `.github/workflows/ci.yml` | 수정 | team 스택 fmt/validate |
| `infra/terraform/team/*` | 생성 | IAM 그룹 + EKS 관리자 Role + Datadog AWS 연동 Role (상시 유지) |
| `infra/terraform/modules/rds/*`, `envs/demo/*` | 수정 | 파라미터 그룹, DBM 시크릿, t3.small, 노드 3대, team access entry |
| `datadog/{monitors,dashboards,workflows}/*.json`, `datadog/README.md` | 생성 (실환경) | Datadog 설정 정의 (마스킹) |
| `docs/setup/*.md`, `docs/demo/01-flash-sale-db/*.md` | 수정/생성 | 운영 문서, Datadog UI 설정 가이드 |
| `docs/design/plans/2026-10-13-demo-bad-deploy.md` | 수정 | ② 전용 Task만 남기도록 정리 |

### 로컬 명령 공통

- pnpm: `npx --yes pnpm@9.15.0 ...` (Windows에 전역 pnpm 없음). 첫 설치는 `NODE_OPTIONS=--use-system-ca` (사내 TLS 검사)
- WSL 명령: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "<명령>"`. `$`가 들어가는 명령은 스크래치패드에 스크립트 파일로 써서 실행 (인라인 시 Git Bash가 변수를 망가뜨림)

---

### Task 1: backend-api 테스트 기반 + 에러 관측 보강 (공통 기반 B3 일부)

**Files:**
- Cherry-pick: 커밋 `ab519cc` → `apps/backend-api/src/lib/orderTotal.ts`, `orderTotal.test.ts`, `routes/orders.ts`, `package.json`(vitest), `pnpm-lock.yaml`
- Modify: `apps/backend-api/src/middleware/errorHandler.ts`
- Test: `apps/backend-api/src/middleware/errorHandler.test.ts`
- Modify: `docs/design/plans/2026-07-23-ci-cd-visibility.md` (Task 1 제목 옆 한 줄)

**Interfaces:**
- Produces: `calculateOrderTotal(items: { price: number; quantity: number }[], couponCode: string | undefined): { subtotal: number; totalAmount: number; isDemoCoupon: boolean }`
- Produces: 5xx 로그 JSON에 `error.kind`, `error.message`, `error.stack`. 4xx(예: 409 `OutOfStockError`)는 `err.message`를 그대로 응답

- [x] **Step 1: ci-cd 브랜치 커밋 가져오기**

```bash
git cherry-pick ab519cc
```
Expected: 충돌 없이 적용. `docs/design/plans/2026-07-23-ci-cd-visibility.md`의 Task 1 제목 옆에 "(2026-10-16 main에 cherry-pick됨)" 추가.

- [x] **Step 2: 의존성 설치 후 기존 테스트 통과 확인**

Run: `NODE_OPTIONS=--use-system-ca npx --yes pnpm@9.15.0 install && npx --yes pnpm@9.15.0 --filter @ringdog/shared run build && npx --yes pnpm@9.15.0 --filter @ringdog/db run build && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: `orderTotal.test.ts` 4 passed

- [x] **Step 3: errorHandler 실패 테스트 작성**

`apps/backend-api/src/middleware/errorHandler.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const setTag = vi.fn();
vi.mock("dd-trace", () => ({
  default: { scope: () => ({ active: () => ({ setTag, context: () => null }) }) },
}));

import { errorHandler } from "./errorHandler";

function mockRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import("express").Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

const req = { path: "/api/orders/checkout", method: "POST" } as import("express").Request;

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setTag.mockClear();
  });

  it("logs standard error.* fields and tags the active span for 500s", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = new TypeError("Cannot read properties of undefined (reading 'trim')");
    const res = mockRes();

    errorHandler(err, req, res, vi.fn());

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error.kind).toBe("TypeError");
    expect(line.error.message).toBe(err.message);
    expect(line.error.stack).toContain("TypeError");
    expect(line.status).toBe(500);
    expect(setTag).toHaveBeenCalledWith("error", err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Internal server error" } });
  });

  it("does not tag the span or expose a stack for 4xx errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = Object.assign(new Error("Out of stock"), { status: 409 });
    const res = mockRes();

    errorHandler(err, req, res, vi.fn());

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error).toBeUndefined();
    expect(setTag).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Out of stock" } });
  });
});
```
(`logger.error`가 `console.error`로 JSON 한 줄을 쓰는지 `packages/shared/src/logger.ts`에서 확인. `console.log`를 쓰면 spy 대상을 맞춘다.)

- [x] **Step 4: 실패 확인**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: FAIL — `expected undefined to be 'TypeError'`

- [x] **Step 5: errorHandler 구현**

`apps/backend-api/src/middleware/errorHandler.ts` 전체:
```ts
import tracer from "dd-trace";
import { NextFunction, Request, Response } from "express";
import { logger } from "@ringdog/shared";

export interface HttpError extends Error {
  status?: number;
}

/**
 * Final error-handling middleware. Keep this last in the middleware chain
 * (see src/app.ts). Logs a structured JSON line so Datadog Agent log
 * collection can pick it up and correlate it with the active APM trace.
 *
 * For 5xx errors it also emits Datadog's standard `error.kind` /
 * `error.message` / `error.stack` log attributes and tags the active span
 * with the error object, so Error Tracking groups the issue with a real
 * stack trace (the http-level 500 alone carries no stack).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status ?? 500;
  const isServerError = status >= 500;

  logger.error(err.message, {
    status,
    path: req.path,
    method: req.method,
    ...(isServerError && {
      error: { kind: err.name, message: err.message, stack: err.stack },
    }),
  });

  if (isServerError) {
    tracer.scope().active()?.setTag("error", err);
  }

  res.status(status).json({
    error: {
      message: isServerError ? "Internal server error" : err.message,
    },
  });
}
```

- [x] **Step 6: 통과 확인 + lint/typecheck**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api lint && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api typecheck`
Expected: 6 passed, lint/typecheck 에러 없음

- [x] **Step 7: Commit**

```bash
git add apps/backend-api/src/middleware docs/design/plans/2026-07-23-ci-cd-visibility.md
git commit -m "feat(backend-api): emit standard error fields and span error tag for 5xx"
```

---

### Task 2: Unified Service Tagging + 리소스 요청값 + LimitRange + CD 수동 실행 (공통 기반 B1·B3, F5 일부)

**Files:**
- Modify: `deploy/helm/charts/ringdog/templates/_helpers.tpl`
- Modify: `deploy/helm/charts/ringdog/templates/backend-api.yaml`, `frontend.yaml`, `chatbot-service.yaml`, `order-consumer.yaml`
- Create: `deploy/helm/charts/ringdog/templates/limitrange.yaml`
- Create: `deploy/helm/charts/ringdog/tests/render-test.sh`
- Modify: `deploy/helm/charts/ringdog/values.yaml`
- Modify: `.github/workflows/cd.yml:3-7`
- Modify: `docs/setup/03-deploy.md` (3-2절)

**Interfaces:**
- Produces: Helm 값 `backendApi.imageTag`, `backendApi.version`(기본 `""` → `image.tag` 사용). 시나리오 ②의 `demo-deploy`가 `--set`으로 사용
- Produces: 4개 Deployment/Pod에 `tags.datadoghq.com/{env,service,version}`, 백엔드 3개 컨테이너에 `DD_VERSION`
- Produces: Helm 값 `<component>.resources` (frontend/backendApi/chatbotService/orderConsumer), `limitRange.*`
- Produces: `bash deploy/helm/charts/ringdog/tests/render-test.sh` — 이후 Task가 검사 블록을 `echo "ALL PASS"` 위에 추가

- [x] **Step 1: 렌더링 테스트 스크립트 작성**

`deploy/helm/charts/ringdog/tests/render-test.sh`:
```bash
#!/usr/bin/env bash
# Helm 렌더링 회귀 테스트. 사용: bash deploy/helm/charts/ringdog/tests/render-test.sh
set -euo pipefail
CHART="$(cd "$(dirname "$0")/.." && pwd)"
BASE=(--set image.registry=reg.example --set image.tag=abc123 --set secrets.databaseUrl=x --set secrets.jwtSecret=y)
fail() { echo "FAIL: $*"; exit 1; }

# 1) 오버라이드 없음 → backend-api도 sha 태그, DD_VERSION=sha
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'image: reg.example/ringdog-backend-api:abc123' || fail "backend-api default tag"
[ "$(echo "$out" | grep -A1 'name: DD_VERSION' | grep -c 'value: "abc123"')" -eq 3 ] || fail "DD_VERSION=abc123 on 3 backends"
[ "$(echo "$out" | grep -c 'tags.datadoghq.com/version: "abc123"')" -eq 8 ] || fail "version label x8 (4 deployments x 2)"

# 2) backend-api만 1.1.0
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set backendApi.imageTag=1.1.0 --set backendApi.version=1.1.0)
echo "$out" | grep -q 'image: reg.example/ringdog-backend-api:1.1.0' || fail "backend-api override tag"
echo "$out" | grep -q 'image: reg.example/ringdog-frontend:abc123' || fail "frontend keeps global tag"
[ "$(echo "$out" | grep -c 'tags.datadoghq.com/version: "1.1.0"')" -eq 2 ] || fail "backend-api version label x2"

# 3) 모든 앱 컨테이너에 requests, 네임스페이스 LimitRange
out=$(helm template ringdog "$CHART" "${BASE[@]}")
[ "$(echo "$out" | grep -c '^ *requests:')" -ge 4 ] || fail "requests on 4 app containers"
echo "$out" | grep -q 'kind: LimitRange' || fail "LimitRange rendered"

echo "ALL PASS"
```

Run (WSL): `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && bash deploy/helm/charts/ringdog/tests/render-test.sh"`
Expected: `FAIL: DD_VERSION=abc123 on 3 backends`

- [x] **Step 2: 헬퍼 추가**

`_helpers.tpl` 끝에 추가:
```yaml
{{/*
Datadog Unified Service Tagging labels. Usage:
  include "ringdog.ddLabels" (dict "env" .Values.datadog.env "service" "ringdog-backend-api" "version" $version)
*/}}
{{- define "ringdog.ddLabels" -}}
tags.datadoghq.com/env: {{ .env | quote }}
tags.datadoghq.com/service: {{ .service | quote }}
tags.datadoghq.com/version: {{ .version | quote }}
{{- end }}
```

- [x] **Step 3: backend-api.yaml 수정**

Deployment `---` 바로 다음 줄(`apiVersion: apps/v1` 위)에 변수 정의를 추가하고 라벨·이미지·env·resources를 바꾼다:
```yaml
{{- $tag := .Values.backendApi.imageTag | default .Values.image.tag }}
{{- $version := .Values.backendApi.version | default $tag }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-api
  namespace: {{ .Values.namespace }}
  labels:
    app: backend-api
    {{- include "ringdog.ddLabels" (dict "env" .Values.datadog.env "service" "ringdog-backend-api" "version" $version) | nindent 4 }}
spec:
  ...
  template:
    metadata:
      labels:
        app: backend-api
        {{- include "ringdog.ddLabels" (dict "env" .Values.datadog.env "service" "ringdog-backend-api" "version" $version) | nindent 8 }}
```
컨테이너:
```yaml
          image: {{ include "ringdog.image" (dict "Values" .Values "repo" "ringdog-backend-api" "tag" $tag) }}
```
env의 `DD_SERVICE` 항목 바로 아래:
```yaml
            - name: DD_VERSION
              value: {{ $version | quote }}
```
`readinessProbe:` 바로 위(컨테이너 레벨):
```yaml
          resources:
            {{- toYaml .Values.backendApi.resources | nindent 12 }}
```

- [x] **Step 4: 나머지 3개 템플릿 수정**

`chatbot-service.yaml`, `order-consumer.yaml`: Deployment metadata.labels와 template.metadata.labels에
```yaml
    {{- include "ringdog.ddLabels" (dict "env" .Values.datadog.env "service" "ringdog-chatbot-service" "version" .Values.image.tag) | nindent 4 }}
```
(pod 쪽은 `nindent 8`, order-consumer는 service `ringdog-order-consumer`), env `DD_SERVICE` 아래에
```yaml
            - name: DD_VERSION
              value: {{ .Values.image.tag | quote }}
```
컨테이너에 `resources: {{- toYaml .Values.chatbotService.resources | nindent 12 }}` (order-consumer는 `.Values.orderConsumer.resources`).
`frontend.yaml`: 기존 `{{- include "ringdog.labels" . | nindent 4 }}` 아래와 pod labels에 service `ringdog-frontend`로 ddLabels만 추가(frontend는 dd-trace가 없어 `DD_VERSION` 불필요), 컨테이너에 `resources: {{- toYaml .Values.frontend.resources | nindent 12 }}`.

- [x] **Step 5: LimitRange 템플릿**

`deploy/helm/charts/ringdog/templates/limitrange.yaml`:
```yaml
# requests를 지정하지 않은 일회성 Pod(cd.yml migrate/smoke, demo-control psql)에도
# 기본 요청값을 줘서 노드 3대 스케줄링이 예측 가능하도록 한다.
apiVersion: v1
kind: LimitRange
metadata:
  name: ringdog-defaults
  namespace: {{ .Values.namespace }}
spec:
  limits:
    - type: Container
      defaultRequest:
        {{- toYaml .Values.limitRange.defaultRequest | nindent 8 }}
      default:
        {{- toYaml .Values.limitRange.default | nindent 8 }}
```

- [x] **Step 6: values.yaml에 기본값 추가**

`frontend:` 블록에:
```yaml
  resources:
    requests: { cpu: 100m, memory: 256Mi }
    limits: { memory: 512Mi }
```
`backendApi:` 블록의 `serviceAccountName` 아래:
```yaml
  # 시나리오 ② demo-deploy.yml이 --set으로 지정. 비우면 전역 image.tag(sha) 사용.
  # cd.yml 1차 helm upgrade는 --reuse-values가 없어 이 값을 다시 비운다.
  imageTag: ""
  version: ""
  # HPA는 CPU 사용률 기준이므로 requests.cpu가 반드시 있어야 한다 (Task 8).
  resources:
    requests: { cpu: 100m, memory: 256Mi }
    limits: { memory: 512Mi }
```
`chatbotService:`, `orderConsumer:` 블록에 각각:
```yaml
  resources:
    requests: { cpu: 50m, memory: 192Mi }
    limits: { memory: 384Mi }
```
파일 끝:
```yaml
limitRange:
  defaultRequest: { cpu: 50m, memory: 64Mi }
  default: { memory: 256Mi }
```

- [x] **Step 7: 테스트 통과 확인**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && bash deploy/helm/charts/ringdog/tests/render-test.sh && helm lint deploy/helm/charts/ringdog --set image.registry=r --set secrets.databaseUrl=x --set secrets.jwtSecret=y"`
Expected: `ALL PASS`, lint `0 chart(s) failed`

- [x] **Step 8: cd.yml 수동 실행 추가**

`.github/workflows/cd.yml`의 `on:` 블록:
```yaml
on:
  push:
    branches:
      - main
  # 환경을 새로 만든 뒤 빈 커밋 없이 배포하기 위한 수동 실행. OIDC 신뢰 조건상
  # main 브랜치에서 실행해야 함 (Actions 화면의 "Use workflow from: main").
  workflow_dispatch:
```

- [x] **Step 9: 문서 갱신**

`docs/setup/03-deploy.md` 3-2절을 다음으로 교체:
```markdown
## 3-2. 배포 실행

GitHub → Actions → **cd** → **Run workflow** (브랜치: `main`) 를 누릅니다.
main에 push해도 자동으로 실행됩니다.
```
(그 아래 진행 상황 확인 내용은 유지, 트러블슈팅의 "Re-run 불가" 행은 "Run workflow로 새로 실행"으로 수정)

- [x] **Step 10: Commit**

```bash
git add deploy/helm/charts/ringdog .github/workflows/cd.yml docs/setup/03-deploy.md
git commit -m "feat(helm): unified service tagging, resource requests, limitrange, manual CD trigger"
```

---

### Task 3: 팀 권한 Terraform 스택 + Datadog AWS 연동 Role (공통 기반 B2, F2 일부)

**Files:**
- Create: `infra/terraform/team/versions.tf`, `backend.tf`, `variables.tf`, `main.tf`, `outputs.tf`
- Modify: `infra/terraform/envs/demo/main.tf` (끝), `infra/terraform/envs/demo/variables.tf` (끝)
- Modify: `.github/workflows/ci.yml` (terraform_plan job)
- Modify: `docs/setup/01-prerequisites.md`, `docs/setup/02-infra.md`

**Interfaces:**
- Produces: IAM 그룹 `ringdog-demo-team`, IAM Role `ringdog-demo-eks-admin`, (External ID가 있을 때) IAM Role `ringdog-datadog-integration`
- Consumes (envs/demo): `var.team_eks_admin_role_name` (기본 `"ringdog-demo-eks-admin"`)

- [x] **Step 1: team 스택 작성**

`infra/terraform/team/versions.tf`:
```hcl
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-2"

  default_tags {
    tags = {
      Project   = "ringdog"
      ManagedBy = "terraform"
      Stack     = "team"
    }
  }
}
```
`infra/terraform/team/backend.tf`:
```hcl
# envs/demo와 같은 bootstrap 버킷/락 테이블, key만 다름.
# 이 스택은 비용이 없으므로 destroy하지 않고 계속 유지한다.
terraform {
  backend "s3" {
    bucket         = "ringdog-tfstate-demo"
    key            = "team/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "ringdog-tfstate-lock"
    encrypt        = true
  }
}
```
`infra/terraform/team/variables.tf`:
```hcl
variable "datadog_external_id" {
  description = "Datadog AWS 통합 타일(Integrations → AWS → Add account → Manually)이 발급한 External ID. 비우면 Datadog 연동 Role을 만들지 않는다. public repo이므로 값은 gitignore된 team/terraform.tfvars에만 둔다."
  type        = string
  default     = ""
  sensitive   = true
}
```
`infra/terraform/team/main.tf`:
```hcl
# 데모 팀원 권한. 입사 = IAM 사용자를 그룹에 추가, 퇴사 = 그룹 제거/사용자 삭제.
# 사용자 목록은 의도적으로 Terraform 밖(IAM 콘솔/CLI)에서 관리한다 —
# public repo에 이름·ARN을 남기지 않고, 변경이 apply 없이 즉시 반영되도록.

data "aws_caller_identity" "current" {}

resource "aws_iam_group" "team" {
  name = "ringdog-demo-team"
}

# terraform apply/destroy로 VPC·EKS·RDS·MSK·OpenSearch·IAM을 만들고 지워야 하므로 데모 범위에서 관리자 권한.
resource "aws_iam_group_policy_attachment" "team_admin" {
  group      = aws_iam_group.team.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

data "aws_iam_policy_document" "eks_admin_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    # 같은 계정 신뢰 — 실제 assume 가능 여부는 호출자의 IAM 정책(그룹 정책)이 결정.
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
}

# envs/demo가 이 Role에 EKS 클러스터 관리자 access entry를 준다.
resource "aws_iam_role" "eks_admin" {
  name               = "ringdog-demo-eks-admin"
  assume_role_policy = data.aws_iam_policy_document.eks_admin_trust.json
}

# --- Datadog AWS integration (CloudWatch: RDS·ALB·MSK, Resource Collection) ---
# 464622532012 = Datadog US1(datadoghq.com)의 AWS 계정. External ID로 우리 org만 assume 가능.
# 권한은 데모 단순화를 위해 AWS 관리형 ReadOnlyAccess (Datadog 문서의 최소 권한 정책 대신).
data "aws_iam_policy_document" "datadog_trust" {
  count = var.datadog_external_id == "" ? 0 : 1

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::464622532012:root"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.datadog_external_id]
    }
  }
}

resource "aws_iam_role" "datadog_integration" {
  count              = var.datadog_external_id == "" ? 0 : 1
  name               = "ringdog-datadog-integration"
  assume_role_policy = data.aws_iam_policy_document.datadog_trust[0].json
}

resource "aws_iam_role_policy_attachment" "datadog_readonly" {
  count      = var.datadog_external_id == "" ? 0 : 1
  role       = aws_iam_role.datadog_integration[0].name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
```
`infra/terraform/team/outputs.tf`:
```hcl
output "team_group_name" {
  value = aws_iam_group.team.name
}

output "eks_admin_role_name" {
  value = aws_iam_role.eks_admin.name
}

output "datadog_integration_role_name" {
  value = try(aws_iam_role.datadog_integration[0].name, "")
}
```

- [x] **Step 2: envs/demo에 access entry 추가**

`infra/terraform/envs/demo/variables.tf` 끝:
```hcl
variable "team_eks_admin_role_name" {
  description = "infra/terraform/team이 만든 EKS 관리자 Role 이름. 이 스택보다 먼저 team 스택이 apply되어 있어야 함."
  type        = string
  default     = "ringdog-demo-eks-admin"
}
```
`infra/terraform/envs/demo/main.tf` 끝:
```hcl
# --- Team kubectl access (infra/terraform/team) ------------------------

# team 스택이 없으면 여기서 "no IAM Role found" 오류로 실패한다 →
# docs/setup/02-infra.md 2-2절(team 스택 apply)을 먼저 수행.
data "aws_iam_role" "team_eks_admin" {
  name = var.team_eks_admin_role_name
}

resource "aws_eks_access_entry" "team_eks_admin" {
  cluster_name  = module.eks.cluster_name
  principal_arn = data.aws_iam_role.team_eks_admin.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "team_eks_admin" {
  cluster_name  = module.eks.cluster_name
  principal_arn = data.aws_iam_role.team_eks_admin.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.team_eks_admin]
}
```
(`module.eks.cluster_name` 출력 이름이 `modules/eks/outputs.tf`에 실제로 있는지 확인. 다르면 그 이름 사용)

- [x] **Step 3: tfvars가 gitignore되는지 확인**

Run: `git check-ignore -v infra/terraform/team/terraform.tfvars`
Expected: `.gitignore`의 규칙이 출력됨. 출력이 없으면 `.gitignore`에 `infra/terraform/**/terraform.tfvars` 추가

- [x] **Step 4: fmt/validate (WSL 내부 경로 복사본에서)**

스크래치패드에 `tfcheck.sh` 작성 후 실행:
```bash
#!/usr/bin/env bash
set -euo pipefail
export SSL_CERT_FILE=~/certs/ca-bundle.pem
rm -rf ~/tf-check && mkdir -p ~/tf-check
rsync -a --exclude .terraform --exclude '*.tfstate*' --exclude .terraform.lock.hcl /mnt/d/Demo/infra/terraform/ ~/tf-check/
for d in team envs/demo; do
  terraform -chdir=$HOME/tf-check/$d fmt -check -diff
  terraform -chdir=$HOME/tf-check/$d init -backend=false -input=false >/dev/null
  terraform -chdir=$HOME/tf-check/$d validate
done
```
Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash /mnt/c/Users/MZC01-ARINAN/AppData/Local/Temp/claude/D--Demo/<session>/scratchpad/tfcheck.sh`
Expected: 두 디렉터리 모두 `Success! The configuration is valid.`

- [x] **Step 5: ci.yml에 team 스택 검증 추가**

`.github/workflows/ci.yml` terraform_plan job의 마지막 step 뒤:
```yaml
      - name: Terraform fmt/validate (team)
        run: |
          terraform -chdir=infra/terraform/team init -backend=false
          terraform -chdir=infra/terraform/team fmt -check
          terraform -chdir=infra/terraform/team validate
```

- [x] **Step 6: 문서 갱신**

- `docs/setup/01-prerequisites.md`: "⚠️ IAM 그룹은 구현 항목 C0-2(...)가 반영된 뒤에 존재합니다." 줄 삭제
- `docs/setup/02-infra.md`: 2-2절의 "(구현 항목 C0-2 반영 후 사용 가능)"과 2-5절의 "⚠️ 공용 Role 접속은..." 인용문 삭제. 2-2절 코드 블록 아래에 추가:
```markdown
apply한 관리자 본인도 `aws iam add-user-to-group --user-name <본인> --group-name ringdog-demo-team`으로 그룹에 넣습니다.

**Datadog AWS 연동 Role (선택, 최초 1회):** Datadog → Integrations → AWS → Add AWS Account → Manually에서
External ID를 받아 `infra/terraform/team/terraform.tfvars`(git에 올라가지 않음)에 `datadog_external_id = "<값>"`으로 적고
team 스택을 다시 apply합니다. 그 다음 Datadog 화면에 계정 ID와 Role 이름 `ringdog-datadog-integration`을 입력합니다.
```
- 트러블슈팅 표에 행 추가:
```markdown
| `no IAM Role found` (`data.aws_iam_role.team_eks_admin`) | team 스택이 아직 없음. 2-2절 team 스택 apply 후 다시 실행 |
```

- [x] **Step 7: Commit**

```bash
git add infra/terraform/team infra/terraform/envs/demo/main.tf infra/terraform/envs/demo/variables.tf .github/workflows/ci.yml docs/setup .gitignore
git commit -m "feat(infra): team IAM stack, shared EKS admin role, Datadog AWS integration role"
```

- [x] **Step 8 (사용자 수행, AWS 반영): team 스택 apply** — **사용자 확인 후에만.** WSL 내부 복사본에서 `terraform -chdir=infra/terraform/team init && terraform -chdir=infra/terraform/team apply` (무료) → 본인을 그룹에 추가

---

### Task 4: RDS DBM 준비 + 사양 변경 + 노드 3대 (F1 일부, F5 일부)

**Files:**
- Modify: `infra/terraform/modules/rds/main.tf`, `outputs.tf`, `variables.tf`
- Modify: `infra/terraform/envs/demo/variables.tf` (`rds_instance_class`, `node_*` 기본값), `terraform.tfvars.example`

**Interfaces:**
- Produces: Secrets Manager `ringdog-demo/rds/datadog` = `{"username":"datadog","password":"<랜덤>"}` (Task 5의 cd.yml이 읽음)
- Produces: RDS 파라미터 그룹 `ringdog-demo-pg16-dbm`

- [x] **Step 1: 파라미터 그룹 + Datadog 계정 시크릿**

`modules/rds/main.tf`의 `random_password.master` 아래에:
```hcl
# --- Datadog DBM -------------------------------------------------------
# 정적 파라미터(shared_preload_libraries 등)는 재부팅이 필요하지만, 이 환경은
# 매번 새로 만들므로 인스턴스 생성 시점에 그대로 적용된다.
resource "aws_db_parameter_group" "this" {
  name   = "${local.name}-pg${var.engine_version}-dbm"
  family = "postgres${var.engine_version}"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "track_activity_query_size"
    value        = "4096"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "pg_stat_statements.max"
    value        = "10000"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "pg_stat_statements.track"
    value        = "ALL"
    apply_method = "immediate"
  }

  parameter {
    name         = "track_io_timing"
    value        = "1"
    apply_method = "immediate"
  }

  tags = var.tags
}

resource "random_password" "datadog" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "datadog" {
  name                    = "${local.name}/rds/datadog"
  description             = "Datadog Agent DBM 접속 계정 (deploy/dbm/datadog-setup.sql이 생성)"
  recovery_window_in_days = 0

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "datadog" {
  secret_id = aws_secretsmanager_secret.datadog.id
  secret_string = jsonencode({
    username = "datadog"
    password = random_password.datadog.result
  })
}
```
`aws_db_instance.this`에 `parameter_group_name = aws_db_parameter_group.this.name` 추가. 모듈 헤더 주석의 `instance_class = db.t3.micro` 설명을 "`db.t3.small` — 시나리오 ① 대량 데이터와 DBM 수집 안정성"으로 수정, `variables.tf`의 `instance_class` 기본값을 `"db.t3.small"`로.
`modules/rds/outputs.tf`에:
```hcl
output "datadog_secret_name" {
  value = aws_secretsmanager_secret.datadog.name
}
```

- [x] **Step 2: envs/demo 기본값**

`envs/demo/variables.tf`:
- `rds_instance_class` default `"db.t3.small"`, description "RDS instance class. 시나리오 ① 대량 데이터·DBM 수집 때문에 db.t3.small."
- `node_desired_size` default `3`, `node_max_size` default `4` (`node_min_size`는 1 유지). `node_instance_types` description에 "노드 자동 확장(Cluster Autoscaler) 없음 — 시나리오 ①의 HPA 최대치 + k6 browser를 3대에 올림" 추가
`terraform.tfvars.example`의 주석 예시도 같은 값으로.

- [x] **Step 3: fmt/validate**

Run: Task 3 Step 4의 `tfcheck.sh`
Expected: 두 디렉터리 모두 valid

- [x] **Step 4: Commit**

```bash
git add infra/terraform/modules/rds infra/terraform/envs/demo
git commit -m "feat(infra): RDS DBM parameter group and datadog secret, db.t3.small, 3 fixed nodes"
```

---

### Task 5: cd.yml — metrics-server, DBM 준비, Agent Postgres 체크 (F1, F5 일부)

**Files:**
- Create: `deploy/dbm/datadog-setup.sql`
- Create: `deploy/helm/datadog-agent/postgres-values.tmpl.yaml`
- Modify: `.github/workflows/cd.yml`

**Interfaces:**
- Consumes: Secrets Manager `ringdog-demo/rds/credentials`, `ringdog-demo/rds/datadog` (Task 4)
- Produces: Datadog 지표 `ringdog.db.blocking_sessions`, `ringdog.db.blocked_sessions` (태그 `env:demo`, `dbinstanceidentifier:ringdog-demo`) — Task 17 모니터가 사용
- Produces: kube-system에 metrics-server (Task 8 HPA가 사용)

- [x] **Step 1: DBM 준비 SQL**

`deploy/dbm/datadog-setup.sql`:
```sql
-- Datadog DBM 준비 (Postgres 16 / RDS). cd.yml이 마스터 계정으로 매 배포 실행 — 여러 번 실행해도 안전.
-- 사용: psql -v ON_ERROR_STOP=1 -v dd_password=<비밀번호> -f datadog-setup.sql
SELECT format('CREATE ROLE datadog WITH LOGIN PASSWORD %L', :'dd_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'datadog') \gexec
ALTER ROLE datadog WITH LOGIN PASSWORD :'dd_password';
ALTER ROLE datadog INHERIT;
GRANT pg_monitor TO datadog;

CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA public;

-- Explain Plan 수집용 (Datadog 문서의 함수 그대로)
CREATE OR REPLACE FUNCTION datadog.explain_statement(
   l_query TEXT,
   OUT explain JSON
)
RETURNS SETOF JSON AS
$$
DECLARE
curs REFCURSOR;
plan JSON;

BEGIN
   OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
   FETCH curs INTO plan;
   CLOSE curs;
   RETURN QUERY SELECT plan;
END;
$$
LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;
```

- [x] **Step 2: Agent Postgres 체크 템플릿**

`deploy/helm/datadog-agent/postgres-values.tmpl.yaml`:
```yaml
# cd.yml이 __DB_HOST__ / __DD_DB_PASSWORD__ 를 치환해 임시 파일로 만들어 -f로 추가한다 (값은 커밋하지 않음).
# Cluster Agent가 이 체크를 노드 Agent 하나에 배정하고, 그 Agent가 RDS에 직접 접속한다.
clusterAgent:
  confd:
    postgres.yaml: |-
      cluster_check: true
      init_config:
      instances:
        - dbm: true
          host: __DB_HOST__
          port: 5432
          username: datadog
          password: "__DD_DB_PASSWORD__"
          dbname: ringdog
          aws:
            instance_endpoint: __DB_HOST__
            region: ap-northeast-2
          tags:
            - "env:demo"
            - "dbinstanceidentifier:ringdog-demo"
          # 시나리오 ① 2차 대처 트리거. "다른 세션을 막고 있고, 자기 트랜잭션이 30초 넘게 열린 세션" 수.
          # deploy/demo/sql/terminate-batch-blockers.sql과 같은 판정(+ application_name 조건)을 쓴다.
          custom_queries:
            - metric_prefix: ringdog.db
              query: |
                WITH blockers AS (
                  SELECT DISTINCT unnest(pg_blocking_pids(pid)) AS pid
                  FROM pg_stat_activity
                  WHERE wait_event_type = 'Lock'
                )
                SELECT
                  count(*) FILTER (WHERE now() - a.xact_start > interval '30 seconds') AS blocking_sessions,
                  (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock') AS blocked_sessions
                FROM blockers b
                JOIN pg_stat_activity a ON a.pid = b.pid
              columns:
                - name: blocking_sessions
                  type: gauge
                - name: blocked_sessions
                  type: gauge
```

- [x] **Step 3: cd.yml 수정 — 순서 재배치와 신규 단계**

`helm_upgrade_eks` job에서:
1. 기존 "Deploy / upgrade Datadog Agent" 단계를 **"Run DB migrations and seed" 다음**으로 옮긴다 (DB 접속 정보가 필요해서).
2. "Resolve deploy-time config from AWS" 단계의 `DB_NAME=...` 줄 다음에 추가:
```bash
          DD_DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id ringdog-demo/rds/datadog --query SecretString --output text | jq -r .password)
```
마스킹 줄에 `echo "::add-mask::${DD_DB_PASSWORD}"` 추가, `$GITHUB_OUTPUT` 블록에:
```bash
            echo "db_host=${DB_HOST}"
            echo "db_user=${DB_USER}"
            echo "db_pass=${DB_PASS}"
            echo "db_name=${DB_NAME}"
            echo "dd_db_password=${DD_DB_PASSWORD}"
```
3. "Run DB migrations and seed" 바로 다음에 새 단계:
```yaml
      # Datadog DBM용 계정·스키마·explain 함수. 매 배포 실행해도 안전(idempotent).
      - name: Prepare Postgres for Datadog DBM
        if: ${{ env.DD_API_KEY != '' }}
        env:
          DB_HOST: ${{ steps.resolve.outputs.db_host }}
          DB_USER: ${{ steps.resolve.outputs.db_user }}
          DB_PASS: ${{ steps.resolve.outputs.db_pass }}
          DB_NAME: ${{ steps.resolve.outputs.db_name }}
          DD_DB_PASSWORD: ${{ steps.resolve.outputs.dd_db_password }}
        run: |
          kubectl -n ${{ env.K8S_NAMESPACE }} run ringdog-dbm-setup --rm -i --restart=Never \
            --image=postgres:16-alpine --env="PGPASSWORD=${DB_PASS}" --command -- \
            psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 \
              -v dd_password="${DD_DB_PASSWORD}" -f - < deploy/dbm/datadog-setup.sql
```
4. 옮긴 "Deploy / upgrade Datadog Agent" 단계를 다음으로 교체:
```yaml
      # Deferred until the app itself is done — enable by adding DD_API_KEY /
      # DD_APP_KEY as repository secrets (no other change needed).
      - name: Deploy / upgrade Datadog Agent
        if: ${{ env.DD_API_KEY != '' }}
        env:
          DB_HOST: ${{ steps.resolve.outputs.db_host }}
          DD_DB_PASSWORD: ${{ steps.resolve.outputs.dd_db_password }}
        run: |
          set -euo pipefail
          PG_VALUES="${RUNNER_TEMP}/postgres-values.yaml"
          sed -e "s|__DB_HOST__|${DB_HOST}|g" -e "s|__DD_DB_PASSWORD__|${DD_DB_PASSWORD}|g" \
            deploy/helm/datadog-agent/postgres-values.tmpl.yaml > "${PG_VALUES}"
          helm upgrade --install datadog-agent datadog/datadog \
            -n ${{ env.K8S_NAMESPACE }} --create-namespace \
            -f deploy/helm/datadog-agent/values.yaml \
            -f "${PG_VALUES}" \
            --set datadog.apiKey=${{ secrets.DD_API_KEY }} \
            --set datadog.appKey=${{ secrets.DD_APP_KEY }}
          rm -f "${PG_VALUES}"
```
5. "Install/upgrade AWS Load Balancer Controller" 다음에 새 단계:
```yaml
      # HPA(backend-api CPU 기준)에 필요. EKS에는 기본 설치되어 있지 않다.
      - name: Install/upgrade metrics-server
        run: |
          helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
          helm repo update
          helm upgrade --install metrics-server metrics-server/metrics-server \
            -n kube-system --version 3.12.2
          kubectl -n kube-system rollout status deployment/metrics-server --timeout=120s
```

- [x] **Step 4: actionlint**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && docker run --rm -v \"\$PWD:/repo\" -w /repo rhysd/actionlint:1.7.3 -color"` (`$PWD` 이스케이프가 깨지면 스크립트 파일로 실행)
Expected: `cd.yml` 변경분에서 새 경고 없음. WSL에 docker가 없거나 이미지 pull이 사내 TLS 때문에 실패하면, 사용자에게 알리고 `go install`/바이너리 다운로드 대신 Task 15의 실제 실행으로 검증을 대체

- [x] **Step 5: Commit**

```bash
git add deploy/dbm deploy/helm/datadog-agent .github/workflows/cd.yml
git commit -m "feat(cd): metrics-server, Postgres DBM setup and agent cluster check with blocking-session metrics"
```

---

### Task 6: backend-api — checkout 재고 차감 + 인기상품 API (F3 일부)

**Files:**
- Create: `apps/backend-api/src/lib/stock.ts`, `stock.test.ts`
- Create: `apps/backend-api/src/lib/trending.ts`
- Create: `apps/backend-api/src/routes/trending.ts`, `trending.test.ts`
- Modify: `apps/backend-api/src/config/env.ts`, `routes/products.ts`, `routes/orders.ts`

**Interfaces:**
- Produces: `reserveStock(tx: StockClient, items: { productId: string; quantity: number }[]): Promise<void>`, `class OutOfStockError extends Error { status = 409 }`, `CHECKOUT_LOCK_TIMEOUT = "5s"`
- Produces: `GET /api/products/trending` → `200 { enabled: false, items: [] }` 또는 `200 { enabled: true, items: TrendingItem[] }`, `TrendingItem = { id: string; name: string; price: number; imageUrl: string | null; tags: string[]; sold: number }` (Task 7 frontend가 같은 모양 사용)
- Produces: `env.featureTrendingWidget: boolean` ← `FEATURE_TRENDING_WIDGET` (Task 8 ConfigMap)

- [x] **Step 1: 재고 차감 실패 테스트**

`apps/backend-api/src/lib/stock.test.ts`:
```ts
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
```

- [x] **Step 2: 인기상품 핸들러 실패 테스트**

`apps/backend-api/src/routes/trending.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

import { createTrendingHandler } from "./trending";

function mockRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import("express").Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}
const req = {} as import("express").Request;
const item = { id: "p1", name: "별 키링", price: 4550, imageUrl: null, tags: ["미니", "별"], sold: 12 };

describe("GET /api/products/trending", () => {
  it("returns enabled:false without touching the DB when the flag is off", async () => {
    const fetchTrending = vi.fn();
    const res = mockRes();
    await createTrendingHandler({ isEnabled: () => false, fetchTrending })(req, res, vi.fn());
    expect(fetchTrending).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ enabled: false, items: [] });
  });

  it("returns the aggregated items when the flag is on", async () => {
    const res = mockRes();
    await createTrendingHandler({ isEnabled: () => true, fetchTrending: async () => [item] })(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ enabled: true, items: [item] });
  });

  it("passes DB errors to the error handler", async () => {
    const next = vi.fn();
    const boom = new Error("canceling statement due to statement timeout");
    await createTrendingHandler({ isEnabled: () => true, fetchTrending: async () => Promise.reject(boom) })(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
```

- [x] **Step 3: 실패 확인**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: FAIL — `Cannot find module './stock'`, `'./trending'`

- [x] **Step 4: stock.ts 구현**

`apps/backend-api/src/lib/stock.ts`:
```ts
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
```

- [x] **Step 5: trending lib + 핸들러 구현**

`apps/backend-api/src/lib/trending.ts`:
```ts
import { prisma } from "@ringdog/db";

export interface TrendingItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  tags: string[];
  sold: number;
}

interface TrendingRow {
  id: string;
  name: string;
  price: string;
  image_url: string | null;
  tags: string[];
  sold: bigint;
}

/**
 * 최근 1시간 주문 기준 인기상품 8개.
 *
 * 데모 시나리오 ①의 원인 ①: orders(created_at)·order_items(order_id) 인덱스가 없어서
 * 대량 데이터(주문 50만·항목 150만)를 매번 Seq Scan + Hash Join 한다. 근본 수정(인덱스 추가)은
 * 시연 중 MCP로 PR만 만들고 머지하지 않는다 (docs/design/specs/2026-10-15-demo-flash-sale-db-design.md).
 */
export async function queryTrending(): Promise<TrendingItem[]> {
  const rows = await prisma.$queryRaw<TrendingRow[]>`
    SELECT p.id, p.name, p.price::text AS price, p.image_url, p.tags, s.sold
    FROM (
      SELECT oi.product_id, SUM(oi.quantity) AS sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at > now() - interval '1 hour'
      GROUP BY oi.product_id
      ORDER BY sold DESC
      LIMIT 8
    ) s
    JOIN products p ON p.id = s.product_id
    ORDER BY s.sold DESC`;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    imageUrl: row.image_url,
    tags: row.tags,
    sold: Number(row.sold),
  }));
}
```
`apps/backend-api/src/routes/trending.ts`:
```ts
import { RequestHandler } from "express";

import type { TrendingItem } from "../lib/trending";

export interface TrendingDeps {
  isEnabled: () => boolean;
  fetchTrending: () => Promise<TrendingItem[]>;
}

/** GET /api/products/trending — 시나리오 ① "실시간 인기상품" 위젯. 플래그가 꺼지면 DB를 건드리지 않는다. */
export function createTrendingHandler(deps: TrendingDeps): RequestHandler {
  return async (_req, res, next) => {
    if (!deps.isEnabled()) {
      res.status(200).json({ enabled: false, items: [] });
      return;
    }
    try {
      const items = await deps.fetchTrending();
      res.status(200).json({ enabled: true, items });
    } catch (err) {
      next(err);
    }
  };
}
```

- [x] **Step 6: 라우트·env·checkout 연결**

`config/env.ts`의 `demoCouponCode` 줄 아래:
```ts
  // 시나리오 ① 인기상품 위젯. ConfigMap ringdog-feature-flags에서 주입, 바꾸면 rollout restart 필요.
  featureTrendingWidget: optional("FEATURE_TRENDING_WIDGET", "false") === "true",
```
`routes/products.ts`: import에 `import { env } from "../config/env";`, `import { queryTrending } from "../lib/trending";`, `import { createTrendingHandler } from "./trending";` 추가하고, `/search` 라우트 **위**(`/:id`보다 먼저)에:
```ts
/** GET /api/products/trending — 시나리오 ① 인기상품 위젯 */
productsRouter.get(
  "/trending",
  createTrendingHandler({ isEnabled: () => env.featureTrendingWidget, fetchTrending: queryTrending }),
);
```
`routes/orders.ts`: import에 `import { reserveStock } from "../lib/stock";` 추가, 트랜잭션을 다음으로 교체:
```ts
      // FR-ORDER-001: stock reservation + order + order items in a single transaction.
      // Status defaults to PENDING; order-consumer asynchronously flips it to
      // PAID after consuming the OrderPlaced event below (simulated payment
      // completion) — this holds for the demo coupon's 0-amount orders too
      // per FR-ORDER-003. timeout(10s) > lock_timeout(5s) so a lock wait
      // surfaces as Postgres' own lock-timeout error, not Prisma's.
      const order = await prisma.$transaction(
        async (tx) => {
          await reserveStock(
            tx,
            cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          );

          const created = await tx.order.create({
            data: {
              userId,
              totalAmount,
              couponCode: isDemoCoupon ? couponCode : null,
              items: {
                create: cartItems.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.product.price,
                })),
              },
            },
          });

          await tx.cartItem.deleteMany({ where: { userId } });

          return created;
        },
        { maxWait: 5000, timeout: 10000 },
      );
```
(`OutOfStockError`는 `status = 409`라 기존 `next(err)` → errorHandler가 409 + "Out of stock"으로 응답)

- [x] **Step 7: 통과 확인 + lint/typecheck**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api lint && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api typecheck`
Expected: 11 passed, 에러 없음. typecheck가 `Prisma.TransactionClient` Pick에서 실패하면 `@ringdog/db`가 `Prisma` 네임스페이스를 re-export하는지(`export * from "../generated/client"`) 확인 — `packages/db`를 먼저 build

- [x] **Step 8: 로컬 동작 확인 (선택, 로컬 Postgres가 있을 때)**

`.env`의 로컬 DB로 `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api dev` → `curl -s localhost:4000/api/products/trending` → `{"enabled":false,"items":[]}`. `FEATURE_TRENDING_WIDGET=true`로 재시작 → `{"enabled":true,"items":[...]}`(주문이 없으면 빈 배열). 로컬 DB가 없으면 건너뛰고 Task 15에서 확인

- [x] **Step 9: Commit**

```bash
git add apps/backend-api/src
git commit -m "feat(backend-api): checkout stock reservation with lock_timeout and flag-gated trending API"
```

---

### Task 7: frontend — 인기상품 위젯 (F3 일부)

**Files:**
- Create: `apps/frontend/src/lib/trending.ts`, `trending.test.ts`
- Create: `apps/frontend/src/components/TrendingWidget.tsx`
- Modify: `apps/frontend/src/components/ProductCatalog.tsx`, `apps/frontend/package.json`

**Interfaces:**
- Consumes: `GET /api/products/trending` 응답 모양 (Task 6)
- Produces: `loadTrending(fetcher, timeoutMs?): Promise<TrendingState>`, `TrendingState = { status: "hidden" } | { status: "ready"; items: TrendingItem[] }`

- [x] **Step 1: 위젯 상태 실패 테스트**

`apps/frontend/package.json`: `"test": "vitest run"`, devDependencies에 `"vitest": "^2.0.5"`. 설치: `NODE_OPTIONS=--use-system-ca npx --yes pnpm@9.15.0 install`

`apps/frontend/src/lib/trending.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTrending, TrendingItem } from "./trending";

const item: TrendingItem = { id: "p1", name: "별 키링", price: 4550, imageUrl: null, tags: ["미니", "별"], sold: 12 };

describe("loadTrending", () => {
  afterEach(() => vi.useRealTimers());

  it("is ready when enabled with items", async () => {
    await expect(loadTrending(async () => ({ enabled: true, items: [item] }))).resolves.toEqual({
      status: "ready",
      items: [item],
    });
  });

  it("hides when the flag is off", async () => {
    await expect(loadTrending(async () => ({ enabled: false, items: [] }))).resolves.toEqual({ status: "hidden" });
  });

  it("hides when enabled but nothing sold recently", async () => {
    await expect(loadTrending(async () => ({ enabled: true, items: [] }))).resolves.toEqual({ status: "hidden" });
  });

  it("hides (no error) when the API fails", async () => {
    await expect(loadTrending(async () => Promise.reject(new Error("500")))).resolves.toEqual({ status: "hidden" });
  });

  it("hides (no error) when the API is slower than the timeout", async () => {
    vi.useFakeTimers();
    const slow = (_path: string, init: { signal: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const result = loadTrending(slow, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toEqual({ status: "hidden" });
  });
});
```

- [x] **Step 2: 실패 확인**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/frontend test`
Expected: FAIL — `Cannot find module './trending'`

- [x] **Step 3: trending.ts 구현**

`apps/frontend/src/lib/trending.ts`:
```ts
export interface TrendingItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  tags: string[];
  sold: number;
}

export interface TrendingResponse {
  enabled: boolean;
  items: TrendingItem[];
}

export type TrendingState = { status: "hidden" } | { status: "ready"; items: TrendingItem[] };

export type TrendingFetcher = (path: string, init: { signal: AbortSignal }) => Promise<TrendingResponse>;

/** 장애 중에도 화면에 에러를 띄우지 않도록, 늦거나 실패하면 위젯을 숨긴다. */
export const TRENDING_TIMEOUT_MS = 5000;

export async function loadTrending(
  fetcher: TrendingFetcher,
  timeoutMs: number = TRENDING_TIMEOUT_MS,
): Promise<TrendingState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const data = await fetcher("/api/products/trending", { signal: controller.signal });
    if (!data.enabled || data.items.length === 0) {
      return { status: "hidden" };
    }
    return { status: "ready", items: data.items };
  } catch {
    return { status: "hidden" };
  } finally {
    clearTimeout(timer);
  }
}
```

- [x] **Step 4: 통과 확인**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/frontend test`
Expected: 5 passed

- [x] **Step 5: 위젯 컴포넌트**

`apps/frontend/src/components/TrendingWidget.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductIcon } from "@/components/ProductIcon";
import { apiFetch } from "@/lib/apiClient";
import { loadTrending, TrendingResponse, TrendingState } from "@/lib/trending";

// 플래그가 꺼져 있으면 응답이 바로 오므로, 그 사이에는 스켈레톤을 그리지 않는다
// (꺼진 화면 = 기존 홈 화면, 빈 자리도 깜빡임도 없음).
const SKELETON_DELAY_MS = 300;

type WidgetState = TrendingState | { status: "loading" } | { status: "pending" };

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

/**
 * 시나리오 ① "실시간 인기상품" 위젯. 플래그는 페이지 로드 때 한 번만 확인한다 —
 * 보고 있는 화면에서 갑자기 접혀 상품 목록이 밀려 올라가지 않게 하기 위해서다.
 * 상품 목록(ProductCatalog)은 이 위젯을 기다리지 않는다.
 */
export function TrendingWidget(): JSX.Element | null {
  const [state, setState] = useState<WidgetState>({ status: "pending" });

  useEffect(() => {
    let active = true;
    const skeletonTimer = setTimeout(() => {
      if (active) setState((s) => (s.status === "pending" ? { status: "loading" } : s));
    }, SKELETON_DELAY_MS);

    void loadTrending((path, init) => apiFetch<TrendingResponse>(path, init)).then((result) => {
      if (active) setState(result);
    });

    return () => {
      active = false;
      clearTimeout(skeletonTimer);
    };
  }, []);

  if (state.status === "pending" || state.status === "hidden") {
    return null;
  }

  if (state.status === "loading") {
    return <div aria-hidden className="mb-6 h-40 animate-pulse rounded-2xl bg-cream-100" />;
  }

  return (
    <section aria-label="실시간 인기상품" className="mb-6 h-40 rounded-2xl bg-white p-4 shadow-soft">
      <h2 className="font-heading text-lg text-stone-800">실시간 인기상품</h2>
      <ol className="mt-2 flex gap-3 overflow-x-auto">
        {state.items.map((item, index) => (
          <li key={item.id} className="w-24 shrink-0">
            <Link href={`/products/${item.id}`} className="text-inherit no-underline">
              <ProductIcon tags={item.tags} name={item.name} className="aspect-square w-full" />
              <div className="mt-1 truncate text-xs text-stone-700">
                {index + 1}. {item.name}
              </div>
              <div className="text-xs text-stone-500">{formatPrice(item.price)}</div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
```
(`bg-cream-100`, `shadow-soft`가 `tailwind.config.ts`에 있는지 확인 — 없으면 기존 컴포넌트가 쓰는 배경색 클래스로 바꾼다)

- [x] **Step 6: ProductCatalog에 배치**

`apps/frontend/src/components/ProductCatalog.tsx`: `import { TrendingWidget } from "./TrendingWidget";` 추가, `return (` 안 `<section>` 바로 다음 줄에:
```tsx
      {!q && <TrendingWidget />}
```

- [x] **Step 7: lint/typecheck**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/frontend lint && npx --yes pnpm@9.15.0 --filter @ringdog/frontend typecheck`
Expected: 에러 없음

- [x] **Step 8: Commit**

```bash
git add apps/frontend pnpm-lock.yaml
git commit -m "feat(frontend): trending widget that hides on disabled, slow or failing API"
```

---

### Task 8: Helm — 플래그 ConfigMap + backend-api HPA (F3·F5 일부)

**Files:**
- Create: `deploy/helm/charts/ringdog/templates/feature-flags.yaml`, `backend-api-hpa.yaml`
- Modify: `deploy/helm/charts/ringdog/templates/backend-api.yaml`, `values.yaml`, `tests/render-test.sh`

**Interfaces:**
- Produces: Helm 값 `featureFlags.trendingWidget`(`"false"`), `backendApi.hpa.{enabled,minReplicas,maxReplicas,targetCPUUtilization}` (기본 `true/1/4/50`)
- Produces: ConfigMap `ringdog-feature-flags` (Task 11 `demo-control.sh`가 `helm --set featureFlags.trendingWidget=...` + `rollout restart`로 토글)

- [x] **Step 1: 렌더링 테스트 추가 (실패 확인)**

`render-test.sh`의 `echo "ALL PASS"` 위에:
```bash
# 4) 플래그 ConfigMap + backend-api가 읽음, 기본 OFF
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'name: ringdog-feature-flags' || fail "feature flag configmap"
echo "$out" | grep -q 'FEATURE_TRENDING_WIDGET: "false"' || fail "flag off by default"
echo "$out" | grep -A3 'name: FEATURE_TRENDING_WIDGET' | grep -q 'configMapKeyRef' || fail "backend-api reads flag from configmap"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set featureFlags.trendingWidget=true)
echo "$out" | grep -q 'FEATURE_TRENDING_WIDGET: "true"' || fail "flag on"

# 5) HPA 1→4, HPA가 켜지면 Deployment에 replicas를 두지 않음 (helm upgrade가 HPA를 덮어쓰지 않게)
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'kind: HorizontalPodAutoscaler' || fail "hpa rendered"
echo "$out" | grep -q 'maxReplicas: 4' || fail "hpa max 4"
echo "$out" | awk '/^kind: Deployment/{d=0} /name: backend-api$/{d=1} d&&/replicas:/{print; exit}' | grep -q . && fail "backend-api replicas must be omitted with HPA"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set backendApi.hpa.enabled=false)
echo "$out" | grep -q 'kind: HorizontalPodAutoscaler' && fail "hpa off"
```
Run: render-test.sh (Task 2 Step 1 명령)
Expected: `FAIL: feature flag configmap`

- [x] **Step 2: ConfigMap 템플릿**

`templates/feature-flags.yaml`:
```yaml
# 시나리오 ① 기능 플래그. 값을 바꾼 뒤 backend-api를 rollout restart 해야 반영된다
# (deploy/demo/demo-control.sh). cd.yml 1차 helm upgrade는 기본값(false)으로 되돌린다.
apiVersion: v1
kind: ConfigMap
metadata:
  name: ringdog-feature-flags
  namespace: {{ .Values.namespace }}
data:
  FEATURE_TRENDING_WIDGET: {{ .Values.featureFlags.trendingWidget | quote }}
```

- [x] **Step 3: HPA 템플릿**

`templates/backend-api-hpa.yaml`:
```yaml
{{- if .Values.backendApi.hpa.enabled }}
# 시나리오 ① "스케일 아웃 함정": Pod가 늘수록 Prisma 커넥션 풀 총합도 늘어 DB 부하가 커진다.
# metrics-server(cd.yml)와 backend-api requests.cpu가 있어야 동작한다.
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-api
  namespace: {{ .Values.namespace }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend-api
  minReplicas: {{ .Values.backendApi.hpa.minReplicas }}
  maxReplicas: {{ .Values.backendApi.hpa.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.backendApi.hpa.targetCPUUtilization }}
{{- end }}
```

- [x] **Step 4: backend-api.yaml 수정**

`spec:` 아래 `replicas:` 줄을:
```yaml
  {{- if not .Values.backendApi.hpa.enabled }}
  replicas: {{ .Values.backendApi.replicaCount }}
  {{- end }}
```
env의 `DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED` 항목 아래:
```yaml
            - name: FEATURE_TRENDING_WIDGET
              valueFrom:
                configMapKeyRef:
                  name: ringdog-feature-flags
                  key: FEATURE_TRENDING_WIDGET
```

- [x] **Step 5: values.yaml**

`backendApi:` 블록에:
```yaml
  hpa:
    enabled: true
    minReplicas: 1
    maxReplicas: 4
    # DB 대기 중에는 CPU가 크게 오르지 않으므로 낮게 잡는다. 리허설(Task 16)에서 조정.
    targetCPUUtilization: 50
```
파일 끝:
```yaml
# 시나리오 ① 기능 플래그 (문자열 "true"/"false")
featureFlags:
  trendingWidget: "false"
```

- [x] **Step 6: 통과 확인**

Run: render-test.sh + helm lint (Task 2 Step 7 명령)
Expected: `ALL PASS`

- [x] **Step 7: Commit**

```bash
git add deploy/helm/charts/ringdog
git commit -m "feat(helm): trending widget flag configmap and backend-api CPU HPA"
```

---

### Task 9: 세일가 반영 배치 `inventory-batch` (F5 일부)

**Files:**
- Create: `apps/backend-api/src/jobs/batchRunner.ts`, `batchRunner.test.ts`
- Create: `apps/backend-api/src/jobs/inventoryBatch.ts`
- Create: `deploy/demo/inventory-batch-job.yaml`
- Create: `deploy/demo/tests/render-test.sh`
- Create: `deploy/demo/demo-control.sh` (이 Task에서는 `render_batch_job` 함수만, 나머지는 Task 11)

**Interfaces:**
- Produces: `runBatch(mode: BatchMode, targets: BatchTarget[], deps: BatchDeps): Promise<void>`, `salePrice(price: number): number`, 상수 `SAFE_CHUNK_SIZE=50`, `FAULT_ITEM_DELAY_MS=1500`, `PROGRESS_EVERY=25`, `SAFE_MAX_ATTEMPTS=3`, `SALE_STOCK=100000`
- Produces: 이미지 내 진입점 `node dist/jobs/inventoryBatch.js` (env `BATCH_MODE=fault|safe`, `BATCH_TARGET_COUNT` 기본 1200)
- Produces: 셸 함수 `render_batch_job <mode> <image>` → stdout에 Job YAML (Task 11이 `kubectl apply -f -`)
- Produces: DB 테이블 `demo_price_backup(product_id text PK, price numeric(10,2), stock int)` (Task 11 `reset.sql`이 복원)

- [x] **Step 1: 배치 순서 실패 테스트**

`apps/backend-api/src/jobs/batchRunner.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

import { BatchDeps, BatchTarget, SAFE_CHUNK_SIZE, runBatch, salePrice } from "./batchRunner";

const targets: BatchTarget[] = Array.from({ length: 120 }, (_, i) => ({ id: `p${i}`, price: 10000 + i * 10, stock: 30 }));

function fakeDeps(failFirstTransaction = false) {
  const transactions: string[][] = [];
  const logs: string[] = [];
  let failed = false;
  const deps: BatchDeps = {
    transaction: vi.fn(async (fn) => {
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
    expect(logs[0]).toBe("세일가 반영 시작: 대상 120개 (장애 모드: 트랜잭션 1개, 마지막에 커밋)");
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
```

- [x] **Step 2: 실패 확인**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: FAIL — `Cannot find module './batchRunner'`

- [x] **Step 3: batchRunner.ts 구현**

`apps/backend-api/src/jobs/batchRunner.ts`:
```ts
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
  deps.log(
    fault
      ? `세일가 반영 시작: 대상 ${count(total)}개 (장애 모드: 트랜잭션 1개, 마지막에 커밋)`
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
```

- [x] **Step 4: 통과 확인**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: 16 passed

- [x] **Step 5: 진입점 inventoryBatch.ts**

`apps/backend-api/src/jobs/inventoryBatch.ts`:
```ts
// IMPORTANT: the tracer must be initialized before any other import (see src/server.ts).
import "../tracer";

import { prisma } from "@ringdog/db";
import { logger } from "@ringdog/shared";

import { BatchMode, BatchTarget, SALE_STOCK, runBatch, salePrice } from "./batchRunner";

/**
 * K8s Job `inventory-batch-<mode>` (deploy/demo/inventory-batch-job.yaml)의 진입점.
 * DATABASE_URL에 application_name=inventory-batch가 붙어 있어 DBM·세션 종료 조건에서 이 이름으로 보인다.
 */
const mode: BatchMode = process.env.BATCH_MODE === "safe" ? "safe" : "fault";
const targetCount = Number(process.env.BATCH_TARGET_COUNT ?? "1200");

async function main(): Promise<void> {
  // 목록과 같은 순서(최신순) → k6가 구매하는 앞쪽 상품부터 잠근다.
  const rows = await prisma.product.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: targetCount,
    select: { id: true, price: true, stock: true },
  });
  const targets: BatchTarget[] = rows.map((r) => ({ id: r.id, price: Number(r.price), stock: r.stock }));
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
```
(`logger.info` 시그니처가 `(message, fields)`인지 `packages/shared/src/logger.ts`에서 확인)

- [x] **Step 6: Job 매니페스트 + 렌더링 테스트 (실패 확인)**

`deploy/demo/tests/render-test.sh`:
```bash
#!/usr/bin/env bash
# deploy/demo 렌더링 테스트. 사용: bash deploy/demo/tests/render-test.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../demo-control.sh
source "$DIR/demo-control.sh"
fail() { echo "FAIL: $*"; exit 1; }

out=$(render_batch_job fault reg.example/ringdog-backend-api:abc123)
echo "$out" | grep -qx '  name: inventory-batch' || fail "fault job name must be exactly inventory-batch"
echo "$out" | grep -q 'backoffLimit: 0' || fail "no retry after session kill"
echo "$out" | grep -q 'activeDeadlineSeconds: 2580' || fail "fault deadline = 180s delay + 40min"
echo "$out" | grep -q 'sleep 180 ' || fail "fault starts 3 min after inject"
echo "$out" | grep -q 'value: "fault"' || fail "BATCH_MODE fault"
echo "$out" | grep -q 'application_name=inventory-batch' || fail "application_name"
echo "$out" | grep -q 'tags.datadoghq.com/version: "abc123"' || fail "UST version from image tag"
echo "$out" | grep -q 'image: reg.example/ringdog-backend-api:abc123' || fail "image"

out=$(render_batch_job safe reg.example/ringdog-backend-api:abc123)
echo "$out" | grep -q 'name: inventory-batch-safe' || fail "safe job name"
echo "$out" | grep -q 'activeDeadlineSeconds: 600' || fail "safe deadline"
echo "$out" | grep -q 'sleep 0 ' || fail "safe starts immediately"
echo "$out" | grep -q '__' && fail "unreplaced placeholder"

echo "ALL PASS"
```
Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && bash deploy/demo/tests/render-test.sh"`
Expected: FAIL — `demo-control.sh: No such file or directory`

- [x] **Step 7: Job 템플릿 + render 함수**

`deploy/demo/inventory-batch-job.yaml`:
```yaml
# 시나리오 ① 세일가 반영 배치. deploy/demo/demo-control.sh의 render_batch_job이 __X__ 를 치환한다.
# backoffLimit 0: 2차 대처로 세션을 끊으면 재시도 없이 Failed로 끝나야 한다 (다시 떠서 락을 또 잡으면 안 됨).
apiVersion: batch/v1
kind: Job
metadata:
  name: inventory-batch-__MODE__
  namespace: ringdog
  labels:
    app: inventory-batch
    batch-mode: __MODE__
    tags.datadoghq.com/env: "demo"
    tags.datadoghq.com/service: "inventory-batch"
    tags.datadoghq.com/version: "__VERSION__"
spec:
  backoffLimit: 0
  activeDeadlineSeconds: __DEADLINE__
  ttlSecondsAfterFinished: 3600
  template:
    metadata:
      labels:
        app: inventory-batch
        batch-mode: __MODE__
        tags.datadoghq.com/env: "demo"
        tags.datadoghq.com/service: "inventory-batch"
        tags.datadoghq.com/version: "__VERSION__"
      annotations:
        ad.datadoghq.com/inventory-batch.logs: '[{"source":"nodejs","service":"inventory-batch"}]'
    spec:
      restartPolicy: Never
      containers:
        - name: inventory-batch
          image: __IMAGE__
          command: ["sh", "-c", "sleep __DELAY__ && exec node dist/jobs/inventoryBatch.js"]
          env:
            - name: BATCH_MODE
              value: "__MODE__"
            - name: BASE_DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: ringdog-app-secrets
                  key: databaseUrl
            # 시크릿 URL은 "?schema=public"으로 끝나므로 &로 이어 붙인다.
            - name: DATABASE_URL
              value: "$(BASE_DATABASE_URL)&application_name=inventory-batch"
            - name: DD_ENV
              value: "demo"
            - name: DD_SERVICE
              value: "inventory-batch"
            - name: DD_VERSION
              value: "__VERSION__"
            - name: DD_AGENT_HOST
              valueFrom:
                fieldRef:
                  fieldPath: status.hostIP
          resources:
            requests: { cpu: 50m, memory: 128Mi }
            limits: { memory: 256Mi }
```
`deploy/demo/demo-control.sh` (이 Task 분량):
```bash
#!/usr/bin/env bash
# 시나리오 ① 시연 조작. .github/workflows/demo-control.yml이 실행한다.
# 사용: demo-control.sh <seed|start|spike|inject|mitigate|reset|stop> [widget|session]
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NS="${K8S_NAMESPACE:-ringdog}"

# render_batch_job <fault|safe> <image> → Job YAML (stdout)
render_batch_job() {
  local mode="$1" image="$2" delay deadline
  if [ "$mode" = "fault" ]; then
    delay=180
    deadline=2580
  else
    delay=0
    deadline=600
  fi
  sed -e "s|__MODE__|${mode}|g" \
      -e "s|__IMAGE__|${image}|g" \
      -e "s|__VERSION__|${image##*:}|g" \
      -e "s|__DELAY__|${delay}|g" \
      -e "s|__DEADLINE__|${deadline}|g" \
      "$DEMO_DIR/inventory-batch-job.yaml"
}

# (Task 11에서 나머지 동작과 main 추가)
```

- [x] **Step 8: 통과 확인**

Run: Step 6 명령
Expected: `ALL PASS`

- [x] **Step 9: lint/typecheck + Commit**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api lint && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api typecheck`
```bash
git add apps/backend-api/src/jobs deploy/demo
git commit -m "feat(demo): inventory-batch job with fault (one long transaction) and safe (chunked) modes"
```

---

### Task 10: 트래픽 생성기 k6 (공통 기반 B4)

**Files:**
- Create: `deploy/helm/charts/ringdog/files/traffic/api.js`, `browser.js`
- Create: `deploy/helm/charts/ringdog/templates/traffic-gen.yaml`
- Modify: `deploy/helm/charts/ringdog/values.yaml`, `tests/render-test.sh`

**Interfaces:**
- Produces: Helm 값 `trafficGen.{enabled(false), targetUrl(""), apiRatePerMin(30), apiUsers(5), checkoutRatio("1"), couponRatio("0"), browserRatePerMin(1), image, browserImage}`
- 프로필 (Task 11이 `--set`으로 지정): 평시 `apiRatePerMin=30, apiUsers=5, checkoutRatio=1` / 급증 `apiRatePerMin=240, apiUsers=40, checkoutRatio=0.25`. 시나리오 ②는 `couponRatio=0.5`를 쓴다
- 데모 계정: API `demo-traffic-<n>@ringdog.demo`, 브라우저 `demo-browser-0..1@ringdog.demo`, 비밀번호 `demo-traffic-pw`

- [x] **Step 1: 렌더링 테스트 추가 (실패 확인)**

`render-test.sh`의 `echo "ALL PASS"` 위에:
```bash
# 6) 트래픽 생성기: 기본 꺼짐, targetUrl 없으면 켜도 렌더링 안 함
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'name: traffic-api' && fail "traffic off by default"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set trafficGen.enabled=true)
echo "$out" | grep -q 'name: traffic-api' && fail "no render without targetUrl"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set trafficGen.enabled=true --set trafficGen.targetUrl=http://alb.example \
  --set trafficGen.apiRatePerMin=240 --set trafficGen.apiUsers=40 --set trafficGen.checkoutRatio=0.25)
echo "$out" | grep -q 'name: traffic-api' || fail "traffic-api rendered"
echo "$out" | grep -q 'name: traffic-browser' || fail "traffic-browser rendered"
echo "$out" | grep -q 'value: "http://alb.example"' || fail "TARGET_URL env"
echo "$out" | grep -A1 'name: RATE_PER_MIN' | grep -q 'value: "240"' || fail "spike rate"
echo "$out" | grep -A1 'name: USERS' | grep -q 'value: "40"' || fail "spike users"
echo "$out" | grep -A1 'name: CHECKOUT_RATIO' | grep -q 'value: "0.25"' || fail "checkout ratio"
echo "$out" | grep -q 'api.js: |' || fail "script configmap"
```
Run: render-test.sh → Expected: `FAIL: traffic-api rendered`

- [x] **Step 2: values.yaml**

파일 끝:
```yaml
# 데모 트래픽 생성기 (k6). deploy/demo/demo-control.sh가 켜고 끄고 프로필을 바꾼다.
# targetUrl은 ALB 주소 — RUM은 브라우저가 Datadog으로 직접 보내므로 실제 외부 경로를 써야 함.
# 평시: rate 30 / users 5 / checkout 1, 급증(시나리오 ①): rate 240 / users 40 / checkout 0.25
trafficGen:
  enabled: false
  targetUrl: ""
  apiRatePerMin: 30
  apiUsers: 5
  checkoutRatio: "1"
  couponRatio: "0"
  browserRatePerMin: 1
  image: grafana/k6:0.52.0
  browserImage: grafana/k6:0.52.0-with-browser
```

- [x] **Step 3: API 스크립트**

`files/traffic/api.js`:
```js
// RingDog API 트래픽: 로그인 → 상품 목록 + 인기상품(홈 화면과 같은 호출) → 검색 → 장바구니 → (일부) 주문 → 주문 내역.
// 시나리오 ① 급증 프로필은 둘러보기 위주(CHECKOUT_RATIO 0.25), 시나리오 ②는 COUPON_RATIO 0.5.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = Number(__ENV.USERS || 5);
const CHECKOUT_RATIO = Number(__ENV.CHECKOUT_RATIO || 1);
const COUPON_RATIO = Number(__ENV.COUPON_RATIO || 0);
const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };
const QUERIES = ["고양이", "가죽", "별", "keyring"];

export const options = {
  scenarios: {
    shop: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE_PER_MIN || 30),
      timeUnit: "1m",
      duration: "720h",
      preAllocatedVUs: USERS,
      maxVUs: USERS, // VU 하나 = 사용자 하나 → 같은 장바구니를 동시에 건드리지 않음
    },
  },
};

const email = (i) => `demo-traffic-${i}@ringdog.demo`;

export function setup() {
  for (let i = 0; i < USERS; i++) {
    // 이미 있으면 409 — 무시
    http.post(`${BASE}/api/auth/signup`, JSON.stringify({ email: email(i), password: PASSWORD }), JSON_HEADERS);
  }
}

export default function () {
  const login = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: email((__VU - 1) % USERS), password: PASSWORD }),
    JSON_HEADERS,
  );
  if (!check(login, { "login 200": (r) => r.status === 200 })) return;
  const auth = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.json("token")}` } };

  const list = http.get(`${BASE}/api/products?limit=20`);
  http.get(`${BASE}/api/products/trending`, { tags: { name: "trending" } });
  const items = list.json("items") || [];
  http.get(`${BASE}/api/products/search?q=${encodeURIComponent(QUERIES[Math.floor(Math.random() * QUERIES.length)])}`);
  if (items.length === 0) return;

  const product = items[Math.floor(Math.random() * items.length)];
  http.post(`${BASE}/api/cart/items`, JSON.stringify({ product_id: product.id, quantity: 1 }), auth);

  if (Math.random() < CHECKOUT_RATIO) {
    const body = Math.random() < COUPON_RATIO ? { coupon_code: "RINGDOG100" } : {};
    const checkout = http.post(`${BASE}/api/orders/checkout`, JSON.stringify(body), auth);
    check(checkout, { "checkout 201": (r) => r.status === 201 });
  }

  http.get(`${BASE}/api/orders`, auth);
}
```

- [x] **Step 4: 브라우저 스크립트**

`files/traffic/browser.js`:
```js
// 실제 Chromium으로 쇼핑 여정 → RUM 세션·Session Replay·인기상품 위젯 로딩·결제 화면 데이터 생성.
import { browser } from "k6/browser";
import http from "k6/http";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = 2;
const COUPON_RATIO = Number(__ENV.COUPON_RATIO || 0);

export const options = {
  scenarios: {
    ui: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE_PER_MIN || 1),
      timeUnit: "1m",
      duration: "720h",
      preAllocatedVUs: 1,
      maxVUs: USERS,
      options: { browser: { type: "chromium" } },
    },
  },
};

const email = (i) => `demo-browser-${i}@ringdog.demo`;

export function setup() {
  for (let i = 0; i < USERS; i++) {
    http.post(`${BASE}/api/auth/signup`, JSON.stringify({ email: email(i), password: PASSWORD }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default async function () {
  // 매 반복마다 새 context = 새 쿠키 = 새 RUM 세션
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"]').fill(email((__VU - 1) % USERS));
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000); // 클라이언트 라우팅(router.push)이라 navigation 이벤트가 없음

    await page.goto(`${BASE}/`);
    const addButton = page.locator('(//button[normalize-space()="장바구니"])[1]');
    await addButton.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(2000); // 인기상품 위젯 로딩이 Replay에 남도록
    await addButton.click();
    await page.waitForTimeout(1500);

    await page.goto(`${BASE}/cart`);
    const coupon = page.locator('input[placeholder="RINGDOG100"]');
    await coupon.waitFor({ state: "visible", timeout: 15000 });
    if (Math.random() >= COUPON_RATIO) {
      await coupon.fill("");
    }
    const pay = page.locator('button[type="submit"]');
    await pay.click();
    await page.waitForTimeout(3000);
    // 시나리오 ① 장애 중 결제가 늦으면 다시 누르는 사용자 → RUM frustration(rage click)
    await pay.click();
    await pay.click();
    await page.waitForTimeout(3000);
  } finally {
    await page.close();
    await context.close();
  }
}
```
(장바구니·쿠폰 입력란의 실제 DOM(`placeholder`, 버튼 문구)을 `apps/frontend/src/app/cart/page.tsx`에서 확인하고 다르면 맞춘다)

- [x] **Step 5: Helm 템플릿**

`templates/traffic-gen.yaml`:
```yaml
{{- if and .Values.trafficGen.enabled .Values.trafficGen.targetUrl }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: traffic-gen-scripts
  namespace: {{ .Values.namespace }}
data:
{{ (.Files.Glob "files/traffic/*.js").AsConfig | indent 2 }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: traffic-api
  namespace: {{ .Values.namespace }}
  labels:
    app: traffic-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: traffic-api
  template:
    metadata:
      labels:
        app: traffic-api
      annotations:
        checksum/scripts: {{ (.Files.Glob "files/traffic/*.js").AsConfig | sha256sum }}
        # k6 자체 로그는 데모 로그 검색을 어지럽히므로 수집 제외
        ad.datadoghq.com/k6.logs: '[{"source":"k6","service":"ringdog-traffic-gen","log_processing_rules":[{"type":"exclude_at_match","name":"drop_all","pattern":".*"}]}]'
    spec:
      containers:
        - name: k6
          image: {{ .Values.trafficGen.image }}
          args: ["run", "--quiet", "/scripts/api.js"]
          env:
            - name: TARGET_URL
              value: {{ .Values.trafficGen.targetUrl | quote }}
            - name: RATE_PER_MIN
              value: {{ .Values.trafficGen.apiRatePerMin | quote }}
            - name: USERS
              value: {{ .Values.trafficGen.apiUsers | quote }}
            - name: CHECKOUT_RATIO
              value: {{ .Values.trafficGen.checkoutRatio | quote }}
            - name: COUPON_RATIO
              value: {{ .Values.trafficGen.couponRatio | quote }}
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { memory: 512Mi }
          volumeMounts:
            - { name: scripts, mountPath: /scripts }
      volumes:
        - name: scripts
          configMap:
            name: traffic-gen-scripts
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: traffic-browser
  namespace: {{ .Values.namespace }}
  labels:
    app: traffic-browser
spec:
  replicas: 1
  selector:
    matchLabels:
      app: traffic-browser
  template:
    metadata:
      labels:
        app: traffic-browser
      annotations:
        checksum/scripts: {{ (.Files.Glob "files/traffic/*.js").AsConfig | sha256sum }}
        ad.datadoghq.com/k6.logs: '[{"source":"k6","service":"ringdog-traffic-gen","log_processing_rules":[{"type":"exclude_at_match","name":"drop_all","pattern":".*"}]}]'
    spec:
      containers:
        - name: k6
          image: {{ .Values.trafficGen.browserImage }}
          args: ["run", "--quiet", "/scripts/browser.js"]
          env:
            - name: TARGET_URL
              value: {{ .Values.trafficGen.targetUrl | quote }}
            - name: RATE_PER_MIN
              value: {{ .Values.trafficGen.browserRatePerMin | quote }}
            - name: COUPON_RATIO
              value: {{ .Values.trafficGen.couponRatio | quote }}
            - name: K6_BROWSER_HEADLESS
              value: "true"
            - name: K6_BROWSER_ARGS
              value: "no-sandbox"
          resources:
            requests: { cpu: 500m, memory: 1Gi }
            limits: { memory: 1536Mi }
          volumeMounts:
            - { name: scripts, mountPath: /scripts }
      volumes:
        - name: scripts
          configMap:
            name: traffic-gen-scripts
{{- end }}
```

- [x] **Step 6: 렌더링 테스트 + k6 문법 검증**

Run: render-test.sh → Expected `ALL PASS`
Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "docker run --rm -v /mnt/d/Demo/deploy/helm/charts/ringdog/files/traffic:/s grafana/k6:0.52.0 inspect /s/api.js && docker run --rm -v /mnt/d/Demo/deploy/helm/charts/ringdog/files/traffic:/s grafana/k6:0.52.0-with-browser inspect /s/browser.js"`
Expected: 두 스크립트 모두 options JSON 출력. (docker가 없거나 사내 TLS로 pull이 실패하면 사용자에게 알리고 Task 15 실환경 확인으로 대체)

- [x] **Step 7: Commit**

```bash
git add deploy/helm/charts/ringdog
git commit -m "feat(demo): k6 API/browser traffic generator with normal and spike profiles"
```

---

### Task 11: 시연 조작 `demo-control` — SQL + 스크립트 + 워크플로 + cd 연결 (F4, F6)

**Files:**
- Create: `deploy/demo/sql/bulk-seed.sql`, `terminate-batch-blockers.sql`, `apply-index.sql`, `reset.sql`
- Modify: `deploy/demo/demo-control.sh` (나머지 동작 + main)
- Modify: `deploy/demo/tests/render-test.sh`
- Create: `.github/workflows/demo-control.yml`
- Modify: `.github/workflows/cd.yml` (대량 시드 단계, 2차 Helm 배포에 평시 트래픽)

**Interfaces:**
- Consumes: `render_batch_job` (Task 9), Helm 값 `featureFlags.trendingWidget`(Task 8), `trafficGen.*`(Task 10), 시크릿 `ringdog-demo/rds/credentials`
- Produces: GitHub Actions `demo-control` — inputs `action`(`seed|start|spike|inject|mitigate|fix-index|reset|stop`), `target`(`widget|session`, mitigate에서만). Datadog Workflow 1(Task 18)이 `mitigate`+`widget` → `fix-index`, Workflow 2가 `mitigate`+`session`으로 호출
- Produces: cd.yml 완료 = 대량 시드 + 평시 트래픽까지 켜진 상태 (Task 12 `demo-up.sh`가 이것을 기다림)

- [x] **Step 1: 대량 시드 SQL**

`deploy/demo/sql/bulk-seed.sql`:
```sql
-- 시나리오 ① 대량 데이터 (cd.yml이 마이그레이션 다음에 매번 실행, 수동: demo-control seed). 이미 했으면 건너뛴다.
-- 상품 1,200개(기존 60 + 1,140), 주문 50만(최근 90일 분산), 주문 항목 150만(앞쪽 상품에 몰리게).
SELECT EXISTS (SELECT 1 FROM users WHERE email = 'bulk-seed@ringdog.demo') AS seeded \gset
\if :seeded
  \echo 'bulk seed: already done, skipping'
  \quit
\endif

BEGIN;

INSERT INTO users (id, email, password_hash, role, created_at)
VALUES (gen_random_uuid(), 'bulk-seed@ringdog.demo', '!', 'customer', now());

-- 기존 60개보다 오래된 것으로 넣어 홈 화면(최신순)에는 기존 상품이 먼저 보이게 한다.
INSERT INTO products (id, name, description, price, stock, tags, created_at)
SELECT gen_random_uuid(),
       format('세일 키링 #%s', 60 + n),
       '타임세일 데모용 대량 상품입니다.',
       5000 + ((n * 1500) % 45000),
       100000,
       ARRAY['미니', '별'],
       now() - interval '1 day' - n * interval '1 minute'
FROM generate_series(1, 1140) AS n;

-- k6가 계속 구매해도 재고가 바닥나지 않게 (재고 부족은 409)
UPDATE products SET stock = 100000;

INSERT INTO orders (id, user_id, total_amount, status, created_at)
SELECT gen_random_uuid(), u.id, 10000, 'PAID', now() - random() * interval '90 days'
FROM generate_series(1, 500000), (SELECT id FROM users WHERE email = 'bulk-seed@ringdog.demo') u;

CREATE TEMP TABLE seed_products ON COMMIT DROP AS
SELECT id, price, row_number() OVER (ORDER BY created_at DESC, id) AS rn FROM products;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price)
SELECT gen_random_uuid(), x.order_id, p.id, x.qty, p.price
FROM (
  SELECT o.id AS order_id,
         1 + floor(power(random(), 3) * (SELECT count(*) FROM seed_products))::int AS rn,
         1 + floor(random() * 3)::int AS qty
  FROM orders o
  CROSS JOIN generate_series(1, 3)
  WHERE o.user_id = (SELECT id FROM users WHERE email = 'bulk-seed@ringdog.demo')
  OFFSET 0 -- 서브쿼리를 먼저 계산해 random()이 행마다 한 번만 평가되게 한다
) x
JOIN seed_products p ON p.rn = x.rn;

COMMIT;

ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
\echo 'bulk seed: done'
```

- [x] **Step 2: 세션 종료 SQL**

`deploy/demo/sql/terminate-batch-blockers.sql`:
```sql
-- 2차 대처: 세일가 반영 배치 세션만 끊는다. 대상은 Job 실행 시점에 다시 조회한다 (Workflow가 PID를 넘기지 않음).
-- 조건: application_name = 'inventory-batch' + 다른 세션을 막고 있음 + 자기 트랜잭션이 30초 넘게 열려 있음.
-- (Agent custom query ringdog.db.blocking_sessions와 같은 판정에 이름 조건만 더한 것)
WITH blockers AS (
  SELECT DISTINCT unnest(pg_blocking_pids(pid)) AS pid
  FROM pg_stat_activity
  WHERE wait_event_type = 'Lock'
)
SELECT a.pid,
       a.application_name,
       date_trunc('second', now() - a.xact_start) AS xact_age,
       pg_terminate_backend(a.pid) AS terminated
FROM blockers b
JOIN pg_stat_activity a ON a.pid = b.pid
WHERE a.application_name = 'inventory-batch'
  AND now() - a.xact_start > interval '30 seconds';
```

- [x] **Step 2-1: 인덱스 적용 SQL (원인 ① 근본 수정)**

`deploy/demo/sql/apply-index.sql`:
```sql
-- 원인 ① 근본 수정 적용. 시연 중 MCP가 만든 PR(demo/fix-index-*)과 같은 이름·같은 인덱스.
-- PR은 main에 머지하지 않고, reset이 이 인덱스를 지운다.
-- CONCURRENTLY를 쓰지 않는 이유: CONCURRENTLY는 열려 있는 모든 트랜잭션(= 세일가 반영 배치)이
-- 끝날 때까지 기다려 멈춘다. 일반 CREATE INDEX는 orders·order_items 쓰기만 잠시 막고,
-- 배치가 잡은 products 행 락과는 겹치지 않는다 (그 시점 결제는 어차피 실패 중).
SET lock_timeout = '30s';
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
ANALYZE orders;
ANALYZE order_items;
\echo 'fix-index: orders_created_at_idx, order_items_order_id_idx ready'
```

- [x] **Step 3: 리셋 SQL**

`deploy/demo/sql/reset.sql`:
```sql
-- 다음 시연자가 같은 상태에서 시작하도록 되돌린다. 새 환경에서도, 두 번 실행해도 오류 없이 끝나야 한다.
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE application_name = 'inventory-batch' AND pid <> pg_backend_pid();

-- 안전 모드가 커밋한 세일가·재고를 원래 값으로
DO $$
BEGIN
  IF to_regclass('public.demo_price_backup') IS NOT NULL THEN
    UPDATE products p SET price = b.price, stock = b.stock
    FROM demo_price_backup b
    WHERE p.id = b.product_id;
    DROP TABLE demo_price_backup;
  END IF;
END $$;

-- 원인 ① 근본 수정 인덱스가 실수로 들어갔다면 제거 (MCP PR은 머지하지 않는다)
DROP INDEX IF EXISTS orders_created_at_idx;
DROP INDEX IF EXISTS order_items_order_id_idx;
```

- [x] **Step 4: 스크립트 테스트 추가 (실패 확인)**

`deploy/demo/tests/render-test.sh`의 `echo "ALL PASS"` 위에:
```bash
# helm 인자 조합 (실제 helm 실행 없이 함수 출력만 검사)
args=$(traffic_args spike http://alb.example)
echo "$args" | grep -q 'trafficGen.apiRatePerMin=240' || fail "spike rate"
echo "$args" | grep -q 'trafficGen.checkoutRatio=0.25' || fail "spike checkout ratio"
args=$(traffic_args normal http://alb.example)
echo "$args" | grep -q 'trafficGen.apiRatePerMin=30' || fail "normal rate"
echo "$args" | grep -q 'trafficGen.targetUrl=http://alb.example' || fail "target url"
grep -q "pg_terminate_backend" "$DIR/sql/terminate-batch-blockers.sql" || fail "kill sql"
grep -q "application_name = 'inventory-batch'" "$DIR/sql/terminate-batch-blockers.sql" || fail "kill only the batch"
grep -q "to_regclass('public.demo_price_backup')" "$DIR/sql/reset.sql" || fail "reset guard for fresh env"
grep -qi "create index concurrently" "$DIR/sql/apply-index.sql" && fail "fix-index must not use CONCURRENTLY (hangs behind the batch transaction)"
grep -q "orders_created_at_idx" "$DIR/sql/apply-index.sql" || fail "fix-index creates the same index reset drops"
grep -q "orders_created_at_idx" "$DIR/sql/reset.sql" || fail "reset drops fix-index index"
```
Run: Task 9 Step 6 명령 → Expected: `traffic_args: command not found`로 FAIL

- [x] **Step 5: demo-control.sh 완성**

`deploy/demo/demo-control.sh`의 `render_batch_job` 아래(`# (Task 11에서...` 줄 대체):
```bash
CHART="$DEMO_DIR/../helm/charts/ringdog"

# traffic_args <normal|spike> <target-url> → helm --set 인자 (stdout, 한 줄에 하나)
traffic_args() {
  local profile="$1" url="$2"
  echo "--set=trafficGen.enabled=true"
  echo "--set=trafficGen.targetUrl=${url}"
  if [ "$profile" = "spike" ]; then
    echo "--set=trafficGen.apiRatePerMin=240"
    echo "--set=trafficGen.apiUsers=40"
    echo "--set=trafficGen.checkoutRatio=0.25"
  else
    echo "--set=trafficGen.apiRatePerMin=30"
    echo "--set=trafficGen.apiUsers=5"
    echo "--set=trafficGen.checkoutRatio=1"
  fi
}

alb_url() {
  local host
  host=$(kubectl -n "$NS" get ingress ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
  if [ -z "$host" ]; then
    echo "::error::ALB 주소가 아직 없습니다. cd 배포가 끝났는지 확인하세요." >&2
    exit 1
  fi
  echo "http://${host}"
}

# helm_set <args...> — 마지막 릴리스 값을 유지한 채 일부만 바꾼다 (Helm 3.14+)
helm_set() {
  helm upgrade ringdog "$CHART" -n "$NS" --reset-then-reuse-values "$@"
}

restart_backend() {
  kubectl -n "$NS" rollout restart deployment/backend-api
  kubectl -n "$NS" rollout status deployment/backend-api --timeout=300s
}

# psql_run <sql-file> — 일회성 psql Pod (LimitRange가 기본 requests를 준다)
psql_run() {
  kubectl -n "$NS" run "demo-psql-$(date +%s)" --rm -i --restart=Never \
    --image=postgres:16-alpine --env="PGPASSWORD=${DB_PASS}" --command -- \
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f - < "$1"
}

backend_image() {
  kubectl -n "$NS" get deployment backend-api -o jsonpath='{.spec.template.spec.containers[0].image}'
}

start_batch() {
  local mode="$1"
  kubectl -n "$NS" delete job "inventory-batch-${mode}" --ignore-not-found --wait=true
  render_batch_job "$mode" "$(backend_image)" | kubectl apply -f -
}

# 시연 중 MCP가 만든 인덱스 PR(demo/fix-index-*)을 닫고 브랜치를 지운다. GH_TOKEN 필요 (워크플로가 넣어 줌).
close_demo_prs() {
  if [ -z "${GH_TOKEN:-}" ]; then
    echo "GH_TOKEN 없음 — 시연 PR 정리를 건너뜁니다"
    return 0
  fi
  gh pr list --state open --json number,headRefName \
    --jq '.[] | select(.headRefName | startswith("demo/fix-index-")) | .number' |
    while read -r pr; do
      gh pr close "$pr" --delete-branch --comment "demo-control reset: 시연용 PR이라 머지하지 않고 닫습니다."
    done
}

main() {
  local action="${1:?action required}" target="${2:-}"
  case "$action" in
    seed)
      psql_run "$DEMO_DIR/sql/bulk-seed.sql"
      ;;
    start)
      mapfile -t args < <(traffic_args normal "$(alb_url)")
      helm_set "${args[@]}"
      ;;
    spike)
      mapfile -t args < <(traffic_args spike "$(alb_url)")
      helm_set "${args[@]}"
      ;;
    inject)
      mapfile -t args < <(traffic_args spike "$(alb_url)")
      helm_set "${args[@]}" --set=featureFlags.trendingWidget=true
      restart_backend
      start_batch fault
      echo "장애 주입 완료: 트래픽 급증 + 위젯 ON, 세일가 반영 배치는 3분 뒤 시작"
      ;;
    mitigate)
      case "$target" in
        widget)
          helm_set --set=featureFlags.trendingWidget=false
          restart_backend
          echo "1차 대처 완료: 위젯 OFF (같은 버전, 기능 플래그만 변경)"
          ;;
        session)
          psql_run "$DEMO_DIR/sql/terminate-batch-blockers.sql"
          # 끊긴 배치 Pod가 남아 있으면 정리 (backoffLimit 0이라 다시 뜨지는 않음)
          kubectl -n "$NS" delete job inventory-batch --ignore-not-found --wait=true
          start_batch safe
          echo "2차 대처 완료: 배치 세션 종료 → 안전 모드(50개씩 커밋)로 재실행"
          ;;
        *)
          echo "::error::mitigate target은 widget 또는 session" >&2
          exit 1
          ;;
      esac
      ;;
    fix-index)
      psql_run "$DEMO_DIR/sql/apply-index.sql"
      helm_set --set=featureFlags.trendingWidget=true
      restart_backend
      echo "원인 ① 근본 수정 적용: 인덱스 2개 생성 + 위젯 다시 ON (PR은 머지하지 않음)"
      ;;
    reset)
      kubectl -n "$NS" delete job -l app=inventory-batch --ignore-not-found --wait=true
      psql_run "$DEMO_DIR/sql/reset.sql"
      mapfile -t args < <(traffic_args normal "$(alb_url)")
      helm_set "${args[@]}" --set=featureFlags.trendingWidget=false
      restart_backend
      close_demo_prs
      echo "리셋 완료: 인덱스 없음, 위젯 OFF, 배치 없음, 세일가 원복, 시연 PR 닫음, 트래픽 평시"
      ;;
    stop)
      helm_set --set=trafficGen.enabled=false
      ;;
    *)
      echo "::error::알 수 없는 action: $action" >&2
      exit 1
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
```

- [x] **Step 6: 테스트 통과 + shellcheck**

Run: Task 9 Step 6 명령 → Expected `ALL PASS`
Run (WSL에 shellcheck가 있으면): `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && shellcheck deploy/demo/demo-control.sh deploy/demo/tests/render-test.sh"` → 경고 없음

- [x] **Step 7: demo-control.yml**

`.github/workflows/demo-control.yml`:
```yaml
name: demo-control

# 시나리오 ① 시연 조작. 사람이 Actions 화면에서 실행하거나, Datadog Workflow가
# GitHub Connection으로 action=mitigate + target을 넣어 실행한다. 반드시 main에서 실행 (OIDC).
on:
  workflow_dispatch:
    inputs:
      action:
        description: "inject / mitigate / fix-index / reset (시연) · seed / start / spike / stop (준비·점검용)"
        required: true
        type: choice
        options: ["inject", "mitigate", "fix-index", "reset", "seed", "start", "spike", "stop"]
      target:
        description: "mitigate 대상: widget(1차) / session(2차)"
        required: false
        type: choice
        default: "widget"
        options: ["widget", "session"]

concurrency:
  group: demo-control   # 같은 helm 릴리스·DB를 건드리므로 직렬화
  cancel-in-progress: false

env:
  AWS_REGION: ap-northeast-2
  EKS_CLUSTER_NAME: ringdog-demo
  K8S_NAMESPACE: ringdog

permissions:
  id-token: write
  contents: write        # reset: 시연 PR 브랜치 삭제
  pull-requests: write   # reset: 시연 PR 닫기

jobs:
  control:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - run: aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER_NAME }} --region ${{ env.AWS_REGION }}
      - uses: azure/setup-helm@v4
      - name: Resolve DB credentials
        run: |
          set -euo pipefail
          DB_JSON=$(aws secretsmanager get-secret-value --secret-id ringdog-demo/rds/credentials --query SecretString --output text)
          DB_PASS=$(jq -r .password <<<"$DB_JSON")
          echo "::add-mask::${DB_PASS}"
          {
            echo "DB_HOST=$(jq -r .host <<<"$DB_JSON")"
            echo "DB_USER=$(jq -r .username <<<"$DB_JSON")"
            echo "DB_NAME=$(jq -r .dbname <<<"$DB_JSON")"
            echo "DB_PASS=${DB_PASS}"
          } >> "$GITHUB_ENV"
      - name: Run ${{ inputs.action }} ${{ inputs.action == 'mitigate' && inputs.target || '' }}
        env:
          GH_TOKEN: ${{ github.token }}
        run: bash deploy/demo/demo-control.sh "${{ inputs.action }}" "${{ inputs.target }}"
```
actionlint 실행 (Task 5 Step 4 명령) → 새 경고 없음

- [x] **Step 7-1: cd.yml에 대량 시드 + 평시 트래픽 연결**

`demo-up.sh` 한 번으로 시연 직전 상태가 되도록 cd가 끝까지 준비한다.
1. "Prepare Postgres for Datadog DBM" 단계 다음에 (조건 없이):
```yaml
      # 시나리오 ① 대량 데이터. 이미 했으면 SQL이 바로 건너뛴다 (첫 배포만 몇 분 더 걸림).
      - name: Bulk seed for demo scenario 01
        env:
          DB_HOST: ${{ steps.resolve.outputs.db_host }}
          DB_USER: ${{ steps.resolve.outputs.db_user }}
          DB_PASS: ${{ steps.resolve.outputs.db_pass }}
          DB_NAME: ${{ steps.resolve.outputs.db_name }}
        run: |
          kubectl -n ${{ env.K8S_NAMESPACE }} run ringdog-bulk-seed --rm -i --restart=Never \
            --image=postgres:16-alpine --env="PGPASSWORD=${DB_PASS}" --command -- \
            psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f - < deploy/demo/sql/bulk-seed.sql
```
(Task 5의 resolve 출력 `db_host`/`db_user`/`db_pass`/`db_name`은 `DD_API_KEY` 조건과 무관하게 항상 만들어진다)
2. "Update RingDog apps with ALB hostname" 단계의 `--set ingress.host=...` 줄 뒤에:
```yaml
            --set trafficGen.enabled=true \
            --set trafficGen.targetUrl="http://${ALB_HOSTNAME}"
```
(1차 Helm 배포는 `--reuse-values`가 없어 트래픽·플래그를 기본값(꺼짐)으로 되돌리고, 2차가 평시 트래픽을 다시 켠다. 위젯 플래그는 OFF 유지)

- [x] **Step 8: Commit**

```bash
git add deploy/demo .github/workflows/demo-control.yml .github/workflows/cd.yml
git commit -m "feat(demo): demo-control workflow (inject/mitigate/fix-index/reset...), cd runs bulk seed and normal traffic"
```

---

### Task 12: 환경 올리기·내리기 스크립트 `demo-up` / `demo-down`

**Files:**
- Create: `scripts/lib-demo-env.sh`, `scripts/demo-up.sh`, `scripts/demo-down.sh`
- Modify: `docs/setup/02-infra.md` (맨 위에 "한 번에 올리기/내리기" 절)

**Interfaces:**
- Consumes: cd.yml `workflow_dispatch`(Task 2), cd.yml의 대량 시드·평시 트래픽(Task 11 Step 7-1)
- Produces: `bash scripts/demo-up.sh [--yes]` → 종료 코드 0 = 노드 3대 Ready + metrics-server + HPA + 트래픽 Pod 2개 Ready, 마지막 줄 `준비 완료: http://<ALB>`
- Produces: `bash scripts/demo-down.sh [--yes]` → 종료 코드 0 = Terraform state 비어 있음 + EKS·RDS 없음 + ALB 없음

- [x] **Step 1: 공통 함수**

`scripts/lib-demo-env.sh`:
```bash
#!/usr/bin/env bash
# demo-up.sh / demo-down.sh 공통. WSL에서 실행한다 (aws/terraform/kubectl/gh/helm 필요).
# Terraform은 /mnt/d가 아닌 WSL 내부 복사본에서 실행 (provider 로딩 timeout 회피).

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${TF_WORK_DIR:-$HOME/tf-work-ringdog}"
TF_DIR="$WORK/infra/terraform/envs/demo"
REGION=ap-northeast-2
CLUSTER=ringdog-demo
NS=ringdog

fail() {
  echo "실패: $*" >&2
  exit 1
}

require_tools() {
  local cmd
  for cmd in aws terraform kubectl helm gh rsync jq; do
    command -v "$cmd" >/dev/null || fail "필요한 명령이 없습니다: $cmd"
  done
  gh auth status >/dev/null 2>&1 || fail "gh 로그인 필요: gh auth login"
}

# confirm <질문> — 첫 인자가 --yes면 묻지 않는다 (호출 쪽에서 YES 변수 설정)
confirm() {
  [ "${YES:-}" = "--yes" ] && return 0
  local answer
  read -r -p "$1 [y/N] " answer
  [ "$answer" = "y" ] || fail "취소했습니다"
}

# 소스(.tf, 잠금 파일, gitignore된 tfvars)만 복사. .terraform(provider 캐시)과 state는 그대로 둔다.
sync_tf() {
  mkdir -p "$WORK/infra/terraform"
  rsync -a --delete --exclude .terraform --exclude '*.tfstate*' --exclude 'tfplan.out' \
    "$REPO/infra/terraform/" "$WORK/infra/terraform/"
  terraform -chdir="$TF_DIR" init -input=false >/dev/null
}
```

- [x] **Step 2: demo-up.sh**

`scripts/demo-up.sh`:
```bash
#!/usr/bin/env bash
# 시나리오 ① 환경 올리기: terraform apply → cd 배포(마이그레이션·대량 시드·DBM·Agent·앱·평시 트래픽) → 확인.
# 사용 (WSL): bash scripts/demo-up.sh [--yes]   약 30~40분. 세션이 끊겨도 살도록 setsid nohup 권장.
set -euo pipefail
# shellcheck source=lib-demo-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-demo-env.sh"
YES="${1:-}"

run_cd() {
  local before run_id=""
  before=$(gh run list --workflow cd.yml --limit 1 --json databaseId --jq '.[0].databaseId // 0')
  gh workflow run cd.yml --ref main
  for _ in $(seq 1 30); do
    run_id=$(gh run list --workflow cd.yml --limit 1 --json databaseId --jq '.[0].databaseId // 0')
    [ "$run_id" != "$before" ] && break
    sleep 5
  done
  [ "$run_id" != "$before" ] || fail "cd 실행을 찾지 못했습니다"
  echo "cd 실행 중: $(gh run view "$run_id" --json url --jq .url)"
  gh run watch "$run_id" --exit-status --interval 30 || fail "cd 실패 — 위 링크에서 로그 확인"
}

verify() {
  local ready host
  ready=$(kubectl get nodes --no-headers | grep -c ' Ready ' || true)
  [ "$ready" -ge 3 ] || fail "Ready 노드가 ${ready}대 (3대 필요)"
  kubectl -n kube-system rollout status deployment/metrics-server --timeout=60s
  kubectl -n "$NS" get hpa backend-api
  kubectl -n "$NS" rollout status deployment/traffic-api --timeout=120s
  kubectl -n "$NS" rollout status deployment/traffic-browser --timeout=300s
  host=$(kubectl -n "$NS" get ingress ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
  [ -n "$host" ] || fail "ALB 주소가 없습니다"
  echo "준비 완료: http://${host}"
}

main() {
  cd "$REPO"
  require_tools
  sync_tf
  terraform -chdir="$TF_DIR" plan -input=false -out=tfplan.out
  confirm "위 계획대로 환경을 만들까요? (EKS·RDS·MSK·OpenSearch 비용 발생)"
  terraform -chdir="$TF_DIR" apply -input=false tfplan.out
  aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION"
  run_cd
  verify
}

main
```

- [x] **Step 3: demo-down.sh**

`scripts/demo-down.sh`:
```bash
#!/usr/bin/env bash
# 시나리오 ① 환경 내리기: 트래픽 끄기 → Ingress 삭제(ALB 정리 대기) → terraform destroy → 남은 리소스 확인.
# Ingress가 만든 ALB는 Terraform 밖이라, 먼저 지우지 않으면 VPC 삭제가 막힌다.
# 사용 (WSL): bash scripts/demo-down.sh [--yes]
set -euo pipefail
# shellcheck source=lib-demo-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-demo-env.sh"
YES="${1:-}"

remove_alb() {
  if ! aws eks describe-cluster --name "$CLUSTER" --region "$REGION" >/dev/null 2>&1; then
    echo "클러스터가 없어 ALB 정리를 건너뜁니다"
    return 0
  fi
  aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION" >/dev/null
  helm upgrade ringdog "$REPO/deploy/helm/charts/ringdog" -n "$NS" --reset-then-reuse-values \
    --set trafficGen.enabled=false >/dev/null 2>&1 || true
  kubectl -n "$NS" delete ingress ringdog --ignore-not-found --wait=true
  local left=""
  for _ in $(seq 1 40); do
    left=$(aws elbv2 describe-load-balancers --region "$REGION" \
      --query "LoadBalancers[?starts_with(LoadBalancerName, 'k8s-ringdog')].LoadBalancerName" --output text)
    [ -z "$left" ] && return 0
    echo "ALB 삭제 대기 중: $left"
    sleep 15
  done
  fail "ALB가 10분 안에 지워지지 않았습니다: $left"
}

verify_gone() {
  [ -z "$(terraform -chdir="$TF_DIR" state list)" ] || fail "Terraform state에 리소스가 남아 있습니다"
  aws eks describe-cluster --name "$CLUSTER" --region "$REGION" >/dev/null 2>&1 && fail "EKS 클러스터가 남아 있습니다"
  aws rds describe-db-instances --db-instance-identifier ringdog-demo --region "$REGION" >/dev/null 2>&1 && fail "RDS가 남아 있습니다"
  echo "삭제 완료: EKS·RDS·ALB 없음, Terraform state 비어 있음 (bootstrap·team 스택은 유지)"
}

main() {
  cd "$REPO"
  require_tools
  confirm "데모 환경을 삭제할까요? (되돌릴 수 없음)"
  remove_alb
  sync_tf
  terraform -chdir="$TF_DIR" destroy -input=false -auto-approve
  verify_gone
}

main
```

- [x] **Step 4: 문법 검사**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && bash -n scripts/lib-demo-env.sh scripts/demo-up.sh scripts/demo-down.sh && (command -v shellcheck >/dev/null && shellcheck -x scripts/*.sh || echo 'shellcheck 없음 — 건너뜀')"`
Expected: 오류 없음. 실제 실행 검증은 Task 15 Step 2(`demo-up`)와 Task 19 Step 6(`demo-down`)

- [x] **Step 5: 문서**

`docs/setup/02-infra.md` 맨 위(1절 앞)에:
```markdown
## 한 번에 올리기 / 내리기 (bootstrap·team 스택이 이미 있을 때)

WSL에서 repo 폴더로 이동한 뒤 실행합니다. 둘 다 시작 전에 확인을 묻습니다.

| 명령 | 하는 일 | 소요 |
|---|---|---|
| `bash scripts/demo-up.sh` | terraform apply → cd 실행(대량 시드·평시 트래픽 포함) → 노드·HPA·트래픽 확인 → ALB 주소 출력 | 약 30~40분 |
| `bash scripts/demo-down.sh` | 트래픽 끄기 → Ingress 삭제(ALB 정리) → terraform destroy → 삭제 확인 | 약 20분 |

아래 절은 같은 내용을 단계별로 직접 할 때의 설명입니다.
```

- [x] **Step 6: Commit**

```bash
git add scripts docs/setup/02-infra.md
git commit -m "feat(demo): one-command demo-up/demo-down scripts"
```

---

### Task 13: 운영 문서 — Datadog UI 설정 가이드 + 시나리오 문서 갱신

**Files:**
- Create: `docs/demo/01-flash-sale-db/datadog-setup.md`
- Modify: `docs/demo/01-flash-sale-db/README.md`, `docs/setup/04-datadog.md`

- [x] **Step 1: datadog-setup.md 작성**

다음 절을 포함 (각 절은 클릭 경로 + 입력값 표, 실제 ID는 `<CONNECTION_ID>` 같은 자리표시):
1. **Slack 연동** — Integrations → Slack → 워크스페이스 연결 → 데모 채널 `#<데모 채널>` 추가
2. **GitHub Connection** — Workflow Automation → Connections → New → GitHub: repo `ringdog`에만 접근하는 fine-grained PAT(Actions: Read and write, Contents: Read). 토큰 값은 문서에 남기지 않음
3. **1차 Workflow `ringdog 인기상품 장애 대응`** (완화 + 근본 수정, 승인 2번) — 트리거 Monitor:
   | # | 액션 | 설정 |
   |---|---|---|
   | 1 | Slack: Make a decision | 메시지 "`{{ Source.monitor.name }}` — 인기상품 위젯을 끌까요? 코드 버전은 그대로이고 기능 플래그만 끕니다.", 버튼 `위젯 OFF` / `무시`, timeout 10분 |
   | 2 | 분기 | `무시` 또는 timeout → Slack "수동 대응 필요" 후 종료 |
   | 3 | GitHub: Trigger workflow run | workflow `demo-control.yml`, ref `main`, inputs `{"action":"mitigate","target":"widget"}` |
   | 4 | Sleep | 180초 |
   | 5 | Datadog: Query metric | RDS CPU(`aws.rds.cpuutilization{dbinstanceidentifier:ringdog-demo}`)와 trending p95 (Task 17에서 확정한 쿼리) |
   | 6 | Slack: Send message | "위젯 OFF 완료. RDS CPU `{{...}}`%, 인기상품 p95 `{{...}}`s. 근본 수정(인덱스) PR을 준비하세요" |
   | 7 | Slack: Make a decision | 메시지 "인덱스 PR과 같은 인덱스(`orders_created_at_idx`, `order_items_order_id_idx`)를 적용하고 위젯을 다시 켤까요? PR은 머지하지 않습니다.", 버튼 `인덱스 적용 후 위젯 ON` / `나중에`, timeout 15분 |
   | 8 | 분기 | `나중에` 또는 timeout → Slack "위젯 OFF 상태 유지" 후 종료 |
   | 9 | GitHub: Trigger workflow run | inputs `{"action":"fix-index"}` |
   | 10 | Sleep | 180초 |
   | 11 | Datadog: Query metric | 5단계와 같은 쿼리 |
   | 12 | Slack: Send message | "원인 ① 해결: 인덱스 적용 + 위젯 ON. 인기상품 p95 `{{...}}`s, RDS CPU `{{...}}`%" |
4. **2차 Workflow `ringdog 배치 세션 종료`** — 1차의 1~6단계와 같은 구조, Slack 승인 timeout **30분**(알림이 11분 무렵 먼저 와서 27분 무렵 처리), 메시지 "`{{ Source.monitor.name }}` — 세일가 반영 배치 세션을 끊을까요? 진행 중이던 세일가 반영은 롤백되고, 안전 모드(50개씩 커밋)로 자동 재실행합니다.", 버튼 `블로킹 세션 종료` / `무시`, inputs `{"action":"mitigate","target":"session"}`, 5단계 checkout p95 + `ringdog.db.blocking_sessions` + 배치 완료 로그 수(`service:inventory-batch "세일가 반영 완료"`), 6단계 "결제 회복: checkout p95 `{{...}}`s, 블로킹 세션 `{{...}}`, 세일가 반영 완료"
5. **Workflow 내보내기** — Export JSON → Connection ID·채널 ID·org ID를 자리표시로 바꿔 `datadog/workflows/mitigate-widget.json`, `mitigate-session.json`으로 커밋
6. **Bits AI SRE** — Task 17 Step 3에서 확인한 켜는 방법

- [x] **Step 2: README 갱신**

`docs/demo/01-flash-sale-db/README.md`:
- 4절 "환경 준비": setup 1~4단계와 시드 항목을 "WSL에서 `bash scripts/demo-up.sh` (약 30~40분, 대량 시드·평시 트래픽까지 자동)"로 교체. bootstrap·team 스택·GitHub Secrets·Datadog 설정은 "최초 1회"로 분리
- 4절 "당일": `reset` 실행을 "**demo-control** → `reset`", 트래픽 항목은 "demo-up이 평시 트래픽까지 켬 — 확인만"
- 3절 대본 3:00 행: "**demo-control** → `inject`", 14:00 행: "Slack 두 번째 승인 **[인덱스 적용 후 위젯 ON]**"
- 5절 리셋 절차: 1번 "**demo-control** → `reset`(시연 PR 자동으로 닫힘)", 환경을 끝낼 때 "WSL에서 `bash scripts/demo-down.sh`"
- 진행 현황 표: 끝낸 Task 항목 ✅

- [x] **Step 3: 04-datadog.md 갱신**

4-5절 "배포 후 수집 확인"에 행 추가: DBM(Database Monitoring → Databases에 `ringdog-demo`, Query Metrics에 쿼리 표시), Infra(`kube_deployment:backend-api`의 HPA 지표), AWS 연동(`aws.rds.cpuutilization`). 4-6절에 "시나리오 ① 설정은 `docs/demo/01-flash-sale-db/datadog-setup.md`" 링크

- [x] **Step 4: Commit**

```bash
git add docs/demo/01-flash-sale-db docs/setup/04-datadog.md
git commit -m "docs(demo-01): Datadog UI setup guide and demo-control based checklist"
```

---

### Task 14: 시나리오 ② 계획 정리 (② 전용 Task만 남기기)

**Files:**
- Modify: `docs/design/plans/2026-10-13-demo-bad-deploy.md`

- [x] **Step 1: 공통 기반 Task를 참조로 바꾸기**

- 맨 위 ⚠️ 블록을 "공통 기반(Task 1·2·3·6 해당 부분)은 시나리오 ① 계획 `2026-10-16-demo-flash-sale-db.md` Task 1·2·3·10에서 구현됨. 이 계획은 ② 전용 Task만 다룬다"로 교체
- Task 1·2·3 본문을 "→ ① 계획 Task N에서 완료" 한 줄로 축소
- Task 6(트래픽 생성기)을 "① 계획 Task 10의 생성기 사용. ② 시연 때는 `demo-control start` 후 `helm upgrade --reset-then-reuse-values --set trafficGen.couponRatio=0.5`" 로 축소하고, `demo-traffic.yml`을 만드는 단계 삭제
- 파일 구조 표에서 ①에서 만든 파일 행 삭제, Review Focus 2·3·5번(①에서 다룸) 정리

- [x] **Step 2: Commit**

```bash
git add docs/design/plans/2026-10-13-demo-bad-deploy.md
git commit -m "docs(demo-02): trim plan to scenario-02-only tasks after shared foundation moved to 01"
```

---

### Task 15 (실환경, 사용자 확인 필요): 환경 생성 + 배포 + 수집 확인

> 💰 이 Task부터 AWS 환경이 필요합니다. 시작 전 사용자에게 `terraform apply`와 `git push` 진행 여부를 확인하고, 세션이 끝날 때 destroy 여부를 확인합니다.

- [x] **Step 1: team 스택** — Task 3 Step 8이 아직이면 수행 (사용자 확인)
- [x] **Step 2: push** — WSL에서 `git push origin main` (사용자 확인). 원격 main에 `cd.yml`의 `workflow_dispatch`와 `demo-control.yml`이 있어야 `demo-up`이 cd를 실행할 수 있다. 환경이 없는 상태라 이 push로 시작된 cd는 실패한다 — 정상(취소해도 됨)
- [x] **Step 3: `demo-up`** — WSL에서 `setsid nohup bash scripts/demo-up.sh --yes > ~/demo-up-$(date +%Y%m%d-%H%M).log 2>&1 &` (사용자 확인 후, 세션 재시작에도 살아남게) → 로그 마지막 줄 `준비 완료: http://<ALB>`. 단계별 소요 시간 기록. 추가 확인: `aws rds describe-db-instances --db-instance-identifier ringdog-demo --query 'DBInstances[0].[DBInstanceClass,DBParameterGroups[0].DBParameterGroupName]'` → `db.t3.small`, `ringdog-demo-pg16-dbm`, `kubectl -n ringdog get hpa backend-api`(TARGETS가 `<unknown>`이 아닌 %), `kubectl -n ringdog get limitrange`
- [x] **Step 4: DBM 수집** — `kubectl -n ringdog exec deploy/datadog-agent-cluster-agent -- datadog-cluster-agent clusterchecks`(Cluster Agent 파드에서 실행)에 `postgres` 체크 배정, 해당 노드 Agent `agent status`에 `postgres` `[OK]`. Datadog MCP(**org가 RingDog인지 먼저 확인**)로 `search_datadog_metrics` → `ringdog.db.blocking_sessions` 존재(값 0)
- [x] **Step 5: 대량 시드 + 평시 트래픽 결과** — cd 로그의 "Bulk seed" 단계 소요 시간 기록, `psql`로 `SELECT count(*) FROM order_items` ≈ 150만. 10분 뒤 MCP로 span `service:ringdog-backend-api env:demo`의 `version`이 sha, RUM 세션 존재, `service:inventory-batch`는 아직 없음 확인. cd를 한 번 더 실행해 "bulk seed: already done, skipping"과 트래픽이 다시 켜지는 것 확인
- [x] **Step 6: reset 안전성 (Review Focus 4)** — 백업 테이블이 없는 상태에서 **demo-control** `reset` 두 번 연속 → 둘 다 성공

---

### Task 16 (실환경): 장애 재현 + 튜닝

> 2026-10-20 진행: 계획 외 선행 확인으로 k6 browser RUM 수집(RUM 초기화 순서 수정 `1d58bea`), `inject` 중 결제 버튼 Rage Click(6건), RUM 브라우저 프로파일링(`43e5ac3`) 완료.
> Step 1~5 완료. 바뀐 것: 급증 프로필 `trendingRatio=0.5`·`ordersRatio=0.1`(`323c56d`, 매 반복 호출 시 위젯 OFF여도 RDS CPU 100%), checkout·배치 공통 잠금 순서 `compareLockOrder`(`fd4d8bd`, 교착 40P01로 배치가 13초 만에 롤백되던 버그), backend-api `connection_limit=10`(`936c8bb`, Step 3 목록 p95 2.6초 → 18ms).
> 리허설 실측: 위젯 ON CPU 약 85% → OFF 24%, fix-index 인덱스 생성 15초(전체 워크플로 124초), 인기상품 p95 126ms, 27분 배치 875/1,200, mitigate session 54초, 안전 모드 약 17초. Step 5의 장애 Job은 `Failed`가 아니라 mitigate가 삭제한다(재시작 없음은 동일). 남은 확인: 인기상품 p95 1.87초로 1차 트리거(2초) 미달 → Task 17에서 기준 조정, `orders`는 `orders_created_at_idx`가 있어도 Seq Scan(원인 미확인).
> 재개: Step 6(reset 원복) → 7 → 8.

- [x] **Step 1: 원인 ①만** — **demo-control** `spike` 후 위젯만 켜기(`helm upgrade --reset-then-reuse-values --set featureFlags.trendingWidget=true` + rollout restart를 로컬 kubectl로) → 5분 동안 확인: DBM Top Query 1위가 trending 쿼리, Explain Plan `Seq Scan`, RDS CPU 80%+, HPA가 Pod를 늘림. 부족하면 조정 순서: `trafficGen.apiUsers`/`apiRatePerMin` ↑ → `backendApi.hpa.targetCPUUtilization` ↓ → 시드 데이터량 ↑
- [x] **Step 2: 원인 ②만** — `reset` → `spike` → 로컬에서 `render_batch_job fault <이미지>`의 `sleep 180`을 `sleep 0`으로 바꿔 apply → 1분 안에 DBM Blocking 트리에 `inventory-batch`(`idle in transaction`), checkout 트레이스의 postgres span이 약 5초 대기 후 `lock timeout` 에러, 배치 로그 "25/1,200 처리 중", `ringdog.db.blocking_sessions` ≥ 1
- [x] **Step 3: 상품 목록은 살아 있는지** — Step 2 상태에서 `/api/products` p95가 평시 수준인지 확인. 커넥션 풀 고갈(`P2024`)로 목록까지 느려지면 `checkoutRatio`를 낮추거나 `CHECKOUT_LOCK_TIMEOUT`을 3초로 줄인다 (설계 4.7 "목록은 빨라졌지만 결제는 실패" 장면 유지)
- [x] **Step 4: 전체 inject + 원인 ① 해결** — `reset` → **demo-control** `inject` → 설계 3.2 타임라인대로 3분 뒤 배치 시작, 9분 무렵 `mitigate widget` → RDS CPU 하락, 14분 무렵 `fix-index` → **배치가 도는 중에도 1분 안에 끝나는지**(멈추면 `CONCURRENTLY`가 섞였거나 다른 긴 트랜잭션이 orders를 잡은 것), Explain Plan이 `Index Scan`, 인기상품 p95 < 500ms, 위젯 ON인데 RDS CPU 안정, checkout은 여전히 실패. 27분 무렵에도 배치가 아직 실행 중인지(로그 진행률) 확인 — 끝나 버렸으면 `FAULT_ITEM_DELAY_MS` ↑
- [x] **Step 5: 2차 대처** — **demo-control** `mitigate session` → 1분 안에 블로킹 0, checkout 201 회복, `inventory-batch` Job `Failed`(재시작 없음, Review Focus 1), `inventory-batch-safe` 로그 "1,200/1,200 완료", 상품 가격이 세일가
- [ ] **Step 6: reset 복원** — 테스트용 PR(브랜치 `demo/fix-index-test`)을 하나 열어 둔 뒤 `reset` → 상품 가격·재고가 시드 값, 인덱스 없음, 배치 Job 없음, 그 PR이 닫히고 브랜치 삭제됨
- [ ] **Step 7: 세션 종료 범위 (Review Focus 5)** — 로컬에서 `kubectl run`으로 psql Pod를 띄워 `SET application_name='manual-check'; BEGIN; UPDATE products SET stock = stock WHERE id = '<앞쪽 상품 id>'; SELECT pg_sleep(120);` 실행(다른 결제를 막는 블로커) → 40초 뒤 **demo-control** `mitigate session` → `manual-check` 세션은 살아 있어야 함(`terminated` 행 0개). 확인 후 그 Pod 삭제
- [ ] **Step 8: 튜닝 값 반영 + Commit** — 바꾼 값(트래픽·HPA·lock_timeout)을 values/코드에 반영하고 설계 3장·운영 README에 실제 소요 시간 기록
```bash
git add -A deploy apps docs && git commit -m "chore(demo-01): tune fault intensity from rehearsal"
```

---

### Task 17 (실환경): 모니터 + 대시보드 + Bits AI SRE

> Datadog MCP가 RingDog org에 연결되어 있고 MCP Write Access가 켜져 있어야 한다. 아니면 사용자에게 `/mcp`로 전환·설정을 요청.

**Files:**
- Create: `datadog/monitors/{composite-checkout.json, rum-checkout-slow.json, apm-checkout-p95.json, trending-p95.json, db-blocking-sessions.json}`, `datadog/dashboards/demo-flash-sale-db.json`, `datadog/README.md`

- [ ] **Step 1: 지표 이름 확정** — MCP `search_datadog_metrics`/`get_datadog_metric_context`로 실제 이름 확인: APM `trace.express.request`(또는 실제 operation 이름)와 `resource_name` 값(`get_/api/products/trending`, `post_/api/orders/checkout`), RUM 결제 지연을 잡을 필드(결제 버튼 action loading time 또는 `/api/orders/checkout` resource duration), `aws.rds.cpuutilization`
- [ ] **Step 2: 모니터 정의** — MCP `validate_monitor_definition` 후 생성. 공통 태그 `project:ringdog`, `env:demo`, `scenario:01-flash-sale-db`
  - `[RingDog demo] RUM 결제 지연` — RUM checkout resource p75 > 3s (5분)
  - `[RingDog demo] APM checkout p95` — `percentile(last_5m):p95:trace.<OP>{env:demo,service:ringdog-backend-api,resource_name:post_/api/orders/checkout} > 3`
  - `[RingDog demo] 결제 장애 (Composite)` — 위 두 모니터 AND. 메시지에 Slack 채널 핸들 (사람 알림 전용, Workflow 없음)
  - `[RingDog demo] 인기상품 API 지연 지속` — `percentile(last_3m):p95:trace.<OP>{...,resource_name:get_/api/products/trending} > 2`. 메시지 `@workflow-<위젯 OFF>`는 Task 18 후 추가
  - `[RingDog demo] DB 블로킹 세션 지속` — `min(last_5m):max:ringdog.db.blocking_sessions{env:demo} >= 1`. `@workflow-<세션 종료>`는 Task 18 후 추가. 리허설에서 샘플에 0이 섞여 알림이 끊기면 `avg(last_5m):max:... > 0.5`로 바꾼다
- [ ] **Step 3: Bits AI SRE** — MCP `list_datadog_skills`(query "bits ai sre monitor") / 공식 문서로 "모니터 알림 시 자동 조사"를 켜는 정확한 방법 확인 → Composite 모니터에 적용, `datadog-setup.md` 6절에 기록
- [ ] **Step 4: 대시보드** — MCP로 `[RingDog demo] 01 타임세일 DB 병목`: RDS CPU·CPU 크레딧, backend-api Pod 수(HPA), DB 커넥션 수(`postgresql.connections`), `ringdog.db.blocking_sessions`/`blocked_sessions`, trending p95, checkout p95·에러율, `/api/products` p95, 이벤트 오버레이(Kubernetes Job 이벤트 `inventory-batch`)
- [ ] **Step 5: 정의 내보내기 + Commit** — JSON에서 `id`, `creator`, `org_id`, 타임스탬프 제거, `datadog/README.md`에 재생성 방법 한 단락
```bash
git add datadog && git commit -m "feat(datadog): scenario 01 monitors and dashboard definitions"
```

---

### Task 18 (실환경, 사용자 UI 작업): Slack + Workflow 2개 (공통 기반 B5, F8)

- [ ] **Step 1:** 사용자가 `datadog-setup.md` 1~4절대로 Slack 연동, GitHub Connection, Workflow 2개 생성 (Claude는 화면별 안내·검토)
- [ ] **Step 2:** 1차 Workflow 수동 실행 → 첫 승인 → **demo-control** `mitigate widget` → 보고 → 두 번째 승인 → `fix-index` → 보고 메시지 확인 (평시에 실행해도 무해). 두 번째 승인에서 `나중에`를 눌러 종료 분기도 확인
- [ ] **Step 3:** 2차 Workflow 수동 실행 → 블로커가 없을 때 `mitigate session`은 아무도 끊지 않고 안전 모드 배치만 실행 → 보고 메시지 확인. 승인 대기 30분 설정 확인 → `reset`
- [ ] **Step 4:** MCP `update_datadog_monitor`로 두 원인별 모니터 메시지에 `@workflow-...` 핸들 추가
- [ ] **Step 5:** 사용자가 Workflow JSON export → Claude가 마스킹 검토 → 커밋
```bash
git add datadog/workflows && git commit -m "feat(datadog): approval-gated mitigation workflows (redacted)"
```

---

### Task 19 (실환경): 전체 리허설 (R, F10)

- [ ] **Step 1:** 운영 README 4절 당일 체크리스트 수행
- [ ] **Step 2:** 설계 3.2 대본대로 진행하며 단계별 실제 시각 기록 (inject→Composite 알림, 알림→Bits AI 결론, 위젯 OFF→RDS CPU 하락, fix-index→인기상품 p95 회복, 세션 종료→checkout 회복, 2차 알림 도착 시각). 성공 기준(설계 1장)과 비교
- [ ] **Step 3:** 5단계 MCP 근본 수정은 대본 순서대로(위젯 OFF와 인덱스 적용 사이) 새 Claude Code 세션에서 프롬프트 → 브랜치 `demo/fix-index-<날짜>`에 Prisma 마이그레이션(`@@index([createdAt])` on Order, `@@index([orderId])` on OrderItem, 인덱스 이름이 `orders_created_at_idx`·`order_items_order_id_idx`인지)이 담긴 PR 생성 확인. **머지하지 않음**
- [ ] **Step 4:** (선택) MCP 포스트모템 초안 프롬프트 확인
- [ ] **Step 5:** **demo-control** `reset` → 시연 PR이 자동으로 닫혔는지 확인 → Bits AI 결론 예시·실제 소요 시간을 대본/작업 로그에 반영, 진행 현황 표 ✅
- [ ] **Step 6:** 사용자에게 환경 삭제 여부 확인 → 삭제하면 WSL에서 `setsid nohup bash scripts/demo-down.sh --yes > ~/demo-down-$(date +%Y%m%d-%H%M).log 2>&1 &` → 로그 마지막 줄 `삭제 완료` 확인
```bash
git add docs/demo && git commit -m "docs(demo-01): rehearsal results"
```
(Step 6의 삭제는 Step 5 커밋 뒤에 한다)
