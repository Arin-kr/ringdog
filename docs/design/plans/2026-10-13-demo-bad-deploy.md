# 데모 시나리오 ① "배포 후 결제 에러 급증" 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** backend-api 문제 버전(v1.1.0) 배포 → Datadog 탐지·AI 분석 → Slack 승인 롤백 → MCP 수정 PR까지 시연 가능한 상태를, 팀원이 repo 문서만으로 재현할 수 있게 만든다.

**Architecture:** main 브랜치에는 관측성 보강(Unified Service Tagging, 에러 로그/스팬 보강), 데모용 GitHub Actions(`demo-build`/`demo-deploy`/`demo-traffic`), k6 트래픽 생성기(Helm 템플릿), 팀 권한 Terraform 스택을 추가한다. 버그 코드는 `demo/bad-deploy` 브랜치에만 둔다. Datadog 모니터·대시보드는 MCP로 만들고 정의를 `datadog/`에 커밋, Workflow는 UI로 만들고 마스킹한 JSON을 커밋한다.

**Tech Stack:** Node 24 / Express / dd-trace 5 / vitest 2, Helm 3, Terraform ≥1.7 (AWS provider ~>5), GitHub Actions, k6 0.52.0 (`k6/browser`), Datadog (APM, Logs, RUM, Watchdog, Bits AI SRE, Workflow Automation, MCP)

**Spec:** [`docs/design/specs/2026-10-13-demo-bad-deploy-design.md`](../specs/2026-10-13-demo-bad-deploy-design.md)
**진행 현황 문서:** [`docs/demo/01-bad-deploy/README.md`](../../demo/01-bad-deploy/README.md) — 각 Task 완료 시 진행 현황 표 갱신

## Global Constraints

- 버전명: 정상 `1.0.0`(main 빌드), 문제 `1.1.0`(`demo/bad-deploy` 빌드). `demo-deploy` 입력은 이 두 값만 허용
- 서비스명: `ringdog-backend-api`, `ringdog-frontend`, `ringdog-chatbot-service`, `ringdog-order-consumer` / env: `demo`
- 데모 쿠폰: `RINGDOG100` (`DEMO_COUPON_CODE`)
- 버그 브랜치 `demo/bad-deploy`와 fix PR은 **절대 main에 머지하지 않음**. fix 브랜치명 `demo/fix-coupon-<날짜>`
- GitHub OIDC는 `ref:refs/heads/main`과 `pull_request`만 신뢰 → 모든 데모 워크플로는 **main에서 실행**하고, 다른 ref는 `actions/checkout`의 `ref` 입력으로 가져온다
- public repo: AWS 계정 ID, ARN, Connection ID, Slack 채널 ID, 키를 커밋하지 않음
- 팀 권한: IAM 그룹 `ringdog-demo-team`, Role `ringdog-demo-eks-admin` (이름 고정)
- 문서는 한국어. 설계/계획 문서는 `docs/design/`
- 환경은 상시 유지하지 않음. Watchdog은 보조 화면(표시되면 보여줌)
- Windows 개발 PC: `aws`/`terraform`/`helm`/`git push`는 WSL에서 실행. Terraform은 `/mnt/d`가 아닌 WSL 내부 경로 복사본에서 실행 (provider 로딩 timeout 회피)

## Review Focus

1. **ECR에 없는 버전으로 `demo-deploy` 실행** → helm upgrade 전에 실패해야 하며, backend-api가 `ImagePullBackOff`로 죽으면 안 됨 (Task 4 Step 1의 이미지 존재 확인 단계)
2. **데모 후 main push로 `cd.yml` 재실행** → `backendApi.imageTag`가 비워져 sha 태그로 돌아가고 `DD_VERSION`도 sha로 일관되게 표시되어야 함 (Task 2 Step 1의 "오버라이드 없음" 렌더링 테스트)
3. **ALB 주소가 없는 상태에서 트래픽 생성기 활성화** → 빈 URL로 CrashLoop 하지 말고 리소스를 아예 렌더링하지 않아야 함 (Task 6 Step 1의 `targetUrl` 빈 값 테스트)
4. **알람 반복/중복 승인으로 롤백이 두 번 실행** → `demo-deploy version=1.0.0` 재실행은 무해(idempotent)해야 하고 동시 실행은 직렬화 (Task 4 concurrency 그룹 + Step 4 수동 검증)
5. **team 스택을 apply하지 않은 계정에서 `envs/demo` apply** → 원인이 드러나는 오류로 실패해야 함 (Task 3 Step 5: data source 이름 오류 메시지 + 02-infra 문서 선행 조건)

---

## 파일 구조

| 파일 | 상태 | 책임 |
|---|---|---|
| `apps/backend-api/src/lib/orderTotal.ts` (+ `.test.ts`) | 생성 (ci-cd 브랜치 커밋 `ab519cc` cherry-pick) | 주문 합계·쿠폰 판별 순수 함수 — 버그가 들어갈 지점 |
| `apps/backend-api/src/middleware/errorHandler.ts` (+ `.test.ts`) | 수정 | 500 에러를 표준 `error.*` 로그 필드 + 활성 span 에러 태그로 기록 |
| `deploy/helm/charts/ringdog/templates/_helpers.tpl` | 수정 | `ringdog.ddLabels` 헬퍼 추가 |
| `deploy/helm/charts/ringdog/templates/{backend-api,frontend,chatbot-service,order-consumer}.yaml` | 수정 | `DD_VERSION` + `tags.datadoghq.com/*` 라벨, backend-api 태그 오버라이드 |
| `deploy/helm/charts/ringdog/templates/traffic-gen.yaml` | 생성 | k6 API/브라우저 트래픽 Deployment + ConfigMap |
| `deploy/helm/charts/ringdog/files/traffic/{api.js,browser.js}` | 생성 | k6 스크립트 |
| `deploy/helm/charts/ringdog/values.yaml` | 수정 | `backendApi.imageTag/version`, `trafficGen.*` |
| `.github/workflows/cd.yml` | 수정 | `workflow_dispatch` 추가 |
| `.github/workflows/demo-build.yml` / `demo-deploy.yml` / `demo-traffic.yml` | 생성 | 버전 이미지 빌드 / 버전 교체·롤백 / 트래픽 on·off |
| `.github/workflows/ci.yml` | 수정 | `infra/terraform/team` fmt/validate 추가 |
| `infra/terraform/team/{versions.tf,backend.tf,main.tf,outputs.tf}` | 생성 | IAM 그룹 + EKS 관리자 Role (상시 유지) |
| `infra/terraform/envs/demo/{main.tf,variables.tf}` | 수정 | 팀 Role에 EKS access entry 부여 |
| `datadog/monitors/*.json`, `datadog/dashboards/*.json`, `datadog/workflows/*.json` | 생성 | Datadog 설정 정의(마스킹) |
| `docs/setup/*.md`, `docs/demo/01-bad-deploy/*.md` | 수정/생성 | 운영 문서 갱신, Datadog UI 설정 가이드 |

---

### Task 1: backend-api 테스트 기반 + 에러 관측 보강

**Files:**
- Cherry-pick: 커밋 `ab519cc` (브랜치 `worktree-ci-cd-visibility`) → `apps/backend-api/src/lib/orderTotal.ts`, `orderTotal.test.ts`, `routes/orders.ts`, `package.json`(vitest), `pnpm-lock.yaml`
- Modify: `apps/backend-api/src/middleware/errorHandler.ts`
- Test: `apps/backend-api/src/middleware/errorHandler.test.ts`

**Interfaces:**
- Produces: `calculateOrderTotal(items: { price: number; quantity: number }[], couponCode: string | undefined): { subtotal: number; totalAmount: number; isDemoCoupon: boolean }` — Task 5가 이 함수에 버그를 넣는다
- Produces: 500 에러 로그 JSON에 `error.kind`, `error.message`, `error.stack` 필드

- [ ] **Step 1: ci-cd 브랜치 커밋 가져오기**

```bash
git cherry-pick ab519cc
```
Expected: 충돌 없이 적용 (`orders.ts`가 `calculateOrderTotal` 사용). ci-cd-visibility 작업을 나중에 머지할 때 같은 변경이라 git이 중복으로 처리함 — 그 계획서 Task 1이 이것으로 대체되었다고 `docs/design/plans/2026-07-23-ci-cd-visibility.md` Task 1 제목 옆에 "(2026-10-13 main에 cherry-pick됨)" 한 줄 추가.

- [ ] **Step 2: 의존성 설치 후 기존 테스트 통과 확인**

Run: `NODE_OPTIONS=--use-system-ca npx --yes pnpm@9.15.0 install && npx --yes pnpm@9.15.0 --filter @ringdog/shared run build && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: `orderTotal.test.ts` 4 passed

- [ ] **Step 3: errorHandler 실패 테스트 작성**

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
    const err = Object.assign(new Error("Not found"), { status: 404 });
    const res = mockRes();

    errorHandler(err, req, res, vi.fn());

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error).toBeUndefined();
    expect(setTag).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Not found" } });
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: FAIL — `line.error`가 undefined (`expected undefined to be 'TypeError'`)

- [ ] **Step 5: errorHandler 구현**

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

- [ ] **Step 6: 통과 확인 + lint/typecheck**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api lint && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api typecheck`
Expected: 6 passed, lint/typecheck 에러 없음

- [ ] **Step 7: Commit**

```bash
git add apps/backend-api/src/middleware docs/design/plans/2026-07-23-ci-cd-visibility.md
git commit -m "feat(backend-api): emit standard error fields and span error tag for 5xx"
```

---

### Task 2: Unified Service Tagging + backend-api 버전 오버라이드 + CD 수동 실행

**Files:**
- Modify: `deploy/helm/charts/ringdog/templates/_helpers.tpl`
- Modify: `deploy/helm/charts/ringdog/templates/backend-api.yaml`, `frontend.yaml`, `chatbot-service.yaml`, `order-consumer.yaml`
- Modify: `deploy/helm/charts/ringdog/values.yaml`
- Modify: `.github/workflows/cd.yml:3-7`
- Modify: `docs/setup/03-deploy.md` (3-2절)

**Interfaces:**
- Produces: Helm 값 `backendApi.imageTag`(string, 기본 `""`), `backendApi.version`(string, 기본 `""`) — 비어 있으면 `image.tag` 사용. Task 4가 `--set`으로 사용
- Produces: 모든 Deployment/Pod에 `tags.datadoghq.com/{env,service,version}` 라벨, 백엔드 3개 컨테이너에 `DD_VERSION`

- [ ] **Step 1: 렌더링 테스트 스크립트 작성 (실패 확인용)**

`deploy/helm/charts/ringdog/tests/render-test.sh` 생성:
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

echo "ALL PASS"
```

Run (WSL): `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && bash deploy/helm/charts/ringdog/tests/render-test.sh"`
Expected: `FAIL: DD_VERSION=abc123 on 3 backends`

- [ ] **Step 2: 헬퍼 추가**

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

- [ ] **Step 3: backend-api.yaml 수정**

Deployment `---` 바로 다음 줄(`apiVersion: apps/v1` 위)에 변수 정의 추가하고, 라벨·이미지·env를 바꾼다:
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
env의 `DD_SERVICE` 항목 바로 아래에:
```yaml
            - name: DD_VERSION
              value: {{ $version | quote }}
```

- [ ] **Step 4: 나머지 3개 템플릿 수정**

`chatbot-service.yaml`, `order-consumer.yaml`: Deployment metadata.labels와 template.metadata.labels에 각각
```yaml
    {{- include "ringdog.ddLabels" (dict "env" .Values.datadog.env "service" "ringdog-chatbot-service" "version" .Values.image.tag) | nindent 4 }}
```
(pod 쪽은 `nindent 8`, order-consumer는 service 값 `ringdog-order-consumer`) 추가, env `DD_SERVICE` 아래에
```yaml
            - name: DD_VERSION
              value: {{ .Values.image.tag | quote }}
```
`frontend.yaml`: 기존 `{{- include "ringdog.labels" . | nindent 4 }}` 아래와 pod labels에 service `ringdog-frontend`로 ddLabels만 추가 (frontend는 dd-trace가 없으므로 `DD_VERSION` env 불필요).

- [ ] **Step 5: values.yaml에 기본값 추가**

`backendApi:` 블록의 `serviceAccountName` 아래:
```yaml
  # 데모 전용 (demo-deploy.yml이 --set으로 지정). 비우면 전역 image.tag(sha) 사용.
  # cd.yml 1차 helm upgrade는 --reuse-values가 없어 이 값을 다시 비운다.
  imageTag: ""
  version: ""
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && bash deploy/helm/charts/ringdog/tests/render-test.sh && helm lint deploy/helm/charts/ringdog --set image.registry=r --set secrets.databaseUrl=x --set secrets.jwtSecret=y"`
Expected: `ALL PASS`, lint `0 chart(s) failed`

- [ ] **Step 7: cd.yml 수동 실행 추가**

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

- [ ] **Step 8: 문서 갱신**

`docs/setup/03-deploy.md` 3-2절을 다음으로 교체:
```markdown
## 3-2. 배포 실행

GitHub → Actions → **cd** → **Run workflow** (브랜치: `main`) 를 누릅니다.
main에 push해도 자동으로 실행됩니다.
```
(아래 "GitHub → Actions → `cd`에서 진행 상황을 확인합니다..." 이후 내용은 유지, 트러블슈팅의 "Re-run 불가" 행은 "Run workflow로 새로 실행"으로 수정)

- [ ] **Step 9: Commit**

```bash
git add deploy/helm/charts/ringdog .github/workflows/cd.yml docs/setup/03-deploy.md
git commit -m "feat(helm): unified service tagging, backend-api version override, manual CD trigger"
```

---

### Task 3: 팀 권한 Terraform 스택 + EKS access entry

**Files:**
- Create: `infra/terraform/team/versions.tf`, `backend.tf`, `main.tf`, `outputs.tf`
- Modify: `infra/terraform/envs/demo/main.tf` (끝에 추가), `infra/terraform/envs/demo/variables.tf` (끝에 추가)
- Modify: `.github/workflows/ci.yml` (terraform_plan job)
- Modify: `docs/setup/01-prerequisites.md`, `docs/setup/02-infra.md` (⚠️ "C0-2 반영 후" 경고 문구 제거)

**Interfaces:**
- Produces: IAM 그룹 `ringdog-demo-team`, IAM Role `ringdog-demo-eks-admin`
- Consumes (envs/demo): `var.team_eks_admin_role_name` (기본 `"ringdog-demo-eks-admin"`)

- [ ] **Step 1: team 스택 작성**

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
# sts:AssumeRole(아래 eks_admin Role)도 이 정책에 포함된다.
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
# 그래서 누가 환경을 만들었든 그룹 멤버 전원이 kubectl을 쓸 수 있다.
resource "aws_iam_role" "eks_admin" {
  name               = "ringdog-demo-eks-admin"
  assume_role_policy = data.aws_iam_policy_document.eks_admin_trust.json
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
```

- [ ] **Step 2: envs/demo에 access entry 추가**

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

- [ ] **Step 3: fmt/validate (WSL 내부 경로 복사본에서)**

`$SCRATCH/tfcheck.sh` 작성 후 실행 (`$`가 포함된 명령은 파일로 실행 — 인라인 시 Git Bash가 변수를 망가뜨림):
```bash
#!/usr/bin/env bash
set -euo pipefail
export SSL_CERT_FILE=~/certs/ca-bundle.pem
rm -rf ~/tf-check && mkdir -p ~/tf-check
rsync -a --exclude .terraform --exclude '*.tfstate*' --exclude .terraform.lock.hcl /mnt/d/Demo/infra/terraform/ ~/tf-check/
for d in team envs/demo; do
  terraform -chdir=~/tf-check/$d fmt -check -diff
  terraform -chdir=~/tf-check/$d init -backend=false -input=false >/dev/null
  terraform -chdir=~/tf-check/$d validate
done
```
Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash /mnt/c/Users/MZC01-ARINAN/AppData/Local/Temp/claude/d--Demo/<session>/scratchpad/tfcheck.sh`
Expected: 두 디렉터리 모두 `Success! The configuration is valid.`

- [ ] **Step 4: ci.yml에 team 스택 검증 추가**

`.github/workflows/ci.yml` terraform_plan job의 마지막 step 뒤에:
```yaml
      - name: Terraform fmt/validate (team)
        run: |
          terraform -chdir=infra/terraform/team init -backend=false
          terraform -chdir=infra/terraform/team fmt -check
          terraform -chdir=infra/terraform/team validate
```

- [ ] **Step 5: 문서 갱신**

- `docs/setup/01-prerequisites.md`: "⚠️ IAM 그룹은 구현 항목 C0-2(...)가 반영된 뒤에 존재합니다." 줄 삭제
- `docs/setup/02-infra.md`: 2-2절의 "(구현 항목 C0-2 반영 후 사용 가능)" 삭제, 2-5절의 "⚠️ 공용 Role 접속은..." 인용문 삭제, 트러블슈팅 표에 행 추가:
```markdown
| `no IAM Role found` (`data.aws_iam_role.team_eks_admin`) | team 스택이 아직 없음. 2-2절 team 스택 apply 후 다시 실행 |
```
- 2-2절 코드 블록 아래에 추가: "apply한 관리자 본인도 `aws iam add-user-to-group --user-name <본인> --group-name ringdog-demo-team`으로 그룹에 넣습니다."

- [ ] **Step 6: Commit**

```bash
git add infra/terraform/team infra/terraform/envs/demo/main.tf infra/terraform/envs/demo/variables.tf .github/workflows/ci.yml docs/setup
git commit -m "feat(infra): team IAM group and shared EKS admin role for kubectl access"
```

- [ ] **Step 7 (사용자 수행, AWS 반영): team 스택 apply**

repo 관리자가 WSL 내부 복사본에서 `terraform -chdir=infra/terraform/team init && terraform -chdir=infra/terraform/team apply` (리소스 3개, 무료) → 본인을 그룹에 추가. **이 단계는 사용자 확인 후에만 실행.**

---

### Task 4: `demo-build` / `demo-deploy` 워크플로

**Files:**
- Create: `.github/workflows/demo-build.yml`, `.github/workflows/demo-deploy.yml`

**Interfaces:**
- Consumes: Helm 값 `backendApi.imageTag`, `backendApi.version` (Task 2)
- Produces: ECR `ringdog-backend-api:<version>` 이미지, workflow_dispatch 입력 `version` ∈ {`1.0.0`, `1.1.0`} — Task 9의 Datadog Workflow가 `demo-deploy.yml`을 `ref=main`, `inputs.version=1.0.0`으로 호출

- [ ] **Step 1: demo-deploy.yml 작성**

```yaml
name: demo-deploy

# 데모 시나리오 ①: backend-api만 지정 버전으로 교체 (롤백도 이 워크플로).
# Datadog Workflow Automation이 롤백 시 version=1.0.0으로 호출한다.
# OIDC 신뢰 조건상 반드시 main 브랜치에서 실행.
on:
  workflow_dispatch:
    inputs:
      version:
        description: "backend-api 버전 (1.0.0 정상 / 1.1.0 문제 버전)"
        required: true
        type: choice
        options: ["1.0.0", "1.1.0"]

# 승인 중복 클릭·알람 반복으로 여러 번 호출돼도 한 번에 하나씩 실행 (같은 버전 재실행은 무해).
concurrency:
  group: demo-deploy
  cancel-in-progress: false

env:
  AWS_REGION: ap-northeast-2
  EKS_CLUSTER_NAME: ringdog-demo
  K8S_NAMESPACE: ringdog
  VERSION: ${{ inputs.version }}
  DD_API_KEY: ${{ secrets.DD_API_KEY }}

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    name: Deploy backend-api ${{ inputs.version }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      # ECR에 없는 버전으로 helm upgrade하면 Pod가 ImagePullBackOff로 죽는다 → 먼저 확인.
      - name: Verify image exists in ECR
        run: |
          set -euo pipefail
          FOUND=$(aws ecr batch-get-image --repository-name ringdog-backend-api \
            --image-ids imageTag="${VERSION}" --query 'length(images)' --output text)
          if [ "$FOUND" != "1" ]; then
            echo "::error::ringdog-backend-api:${VERSION} 이미지가 ECR에 없습니다. demo-build를 먼저 실행하세요."
            exit 1
          fi

      - run: aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER_NAME }} --region ${{ env.AWS_REGION }}

      - uses: azure/setup-helm@v4

      # --reuse-values: cd.yml이 넣은 secrets/Kafka/OpenSearch/IRSA/ALB 값을 그대로 유지.
      - name: Helm upgrade (backend-api only)
        run: |
          helm upgrade ringdog deploy/helm/charts/ringdog -n ${{ env.K8S_NAMESPACE }} --reuse-values \
            --set backendApi.imageTag="${VERSION}" \
            --set backendApi.version="${VERSION}"
          kubectl -n ${{ env.K8S_NAMESPACE }} rollout status deployment/backend-api --timeout=180s

      - name: Send Datadog deployment event
        if: ${{ env.DD_API_KEY != '' }}
        env:
          DD_SITE: ${{ vars.DD_SITE || 'datadoghq.com' }}
        run: |
          curl -sf -X POST "https://api.${DD_SITE}/api/v1/events" \
            -H "Content-Type: application/json" -H "DD-API-KEY: ${DD_API_KEY}" \
            -d @- <<EOF
          {
            "title": "ringdog-backend-api ${VERSION} 배포 (demo-deploy)",
            "text": "demo-deploy.yml by ${{ github.actor }} — backend-api version ${VERSION}",
            "tags": ["project:ringdog", "env:demo", "service:ringdog-backend-api", "version:${VERSION}", "source:demo-deploy"],
            "alert_type": "info",
            "source_type_name": "github"
          }
          EOF
```
(`DD_API_KEY`를 최상위 `env:`에 둔 것은 cd.yml과 같은 방식 — `if:`에서 secrets를 직접 참조할 수 없기 때문)

- [ ] **Step 2: demo-build.yml 작성**

```yaml
name: demo-build

# 데모용 backend-api 버전 이미지 빌드: main → 1.0.0, demo/bad-deploy → 1.1.0.
# ECR은 terraform destroy 때 함께 삭제되므로 환경을 새로 만들 때마다 두 번 실행.
# 워크플로 자체는 main에서 실행(OIDC), 빌드할 코드만 ref 입력으로 checkout.
on:
  workflow_dispatch:
    inputs:
      version:
        description: "이미지 태그"
        required: true
        type: choice
        options: ["1.0.0", "1.1.0"]

env:
  AWS_REGION: ap-northeast-2

permissions:
  id-token: write
  contents: read

jobs:
  build:
    name: Build backend-api ${{ inputs.version }}
    runs-on: ubuntu-latest
    steps:
      - name: Resolve source ref
        id: ref
        run: |
          case "${{ inputs.version }}" in
            1.0.0) echo "ref=main" >> "$GITHUB_OUTPUT" ;;
            1.1.0) echo "ref=demo/bad-deploy" >> "$GITHUB_OUTPUT" ;;
          esac

      - uses: actions/checkout@v7
        with:
          ref: ${{ steps.ref.outputs.ref }}

      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - uses: docker/setup-buildx-action@v4

      - uses: docker/build-push-action@v7
        with:
          context: .
          file: apps/backend-api/Dockerfile
          push: true
          tags: ${{ steps.login-ecr.outputs.registry }}/ringdog-backend-api:${{ inputs.version }}
```
버전→ref를 입력으로 받지 않고 고정 매핑한 이유: 시연자가 잘못된 조합(예: main을 1.1.0으로)을 만들 수 없게.

- [ ] **Step 3: actionlint로 검증**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && docker run --rm -v \"\$PWD:/repo\" -w /repo rhysd/actionlint:1.7.3 -color"`
(`$PWD` 이스케이프가 Git Bash에서 깨지면 Task 3 Step 3처럼 스크립트 파일로 실행)
Expected: 출력 없음(exit 0). 기존 워크플로에서 나오는 경고가 있으면 새 파일(`demo-*.yml`, `cd.yml`의 변경분)과 무관한지 확인

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/demo-build.yml .github/workflows/demo-deploy.yml
git commit -m "feat(ci): demo-build and demo-deploy workflows for backend-api version swap"
```

---

### Task 5: 버그 브랜치 `demo/bad-deploy`

**Files:**
- Modify (브랜치 `demo/bad-deploy`에서만): `apps/backend-api/src/lib/orderTotal.ts`, `orderTotal.test.ts`, `apps/backend-api/src/routes/orders.ts`

**Interfaces:**
- Consumes: Task 1의 `calculateOrderTotal`
- Produces: 쿠폰 미입력 checkout 시 `TypeError: Cannot read properties of undefined (reading 'trim')` (스택: `orderTotal.ts` → `orders.ts`)

- [ ] **Step 1: main 최신 상태에서 브랜치 생성**

```bash
git checkout main && git checkout -b demo/bad-deploy
```

- [ ] **Step 2: "기능 추가" 테스트 작성 (현실적인 개발자의 테스트)**

`orderTotal.test.ts`의 `describe` 블록 안 끝에 추가:
```ts
  it("accepts the demo coupon case-insensitively and ignores surrounding spaces", () => {
    const result = calculateOrderTotal([{ price: 10000, quantity: 1 }], "  ringdog100 ");
    expect(result.isDemoCoupon).toBe(true);
    expect(result.totalAmount).toBe(0);
  });
```
Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test`
Expected: 새 테스트 1개 FAIL

- [ ] **Step 3: 버그가 있는 구현 (의도적)**

`orderTotal.ts`의 시그니처와 판별 줄을 변경:
```ts
export function calculateOrderTotal(
  items: OrderTotalItem[],
  couponCode: string,
): OrderTotalResult {
  // 쿠폰 코드 대소문자·앞뒤 공백 무시
  const isDemoCoupon = couponCode.trim().toUpperCase() === DEMO_COUPON_CODE;
```
`routes/orders.ts`의 body 타입을 "정리":
```ts
    const { coupon_code: couponCode } = req.body as { coupon_code: string };
```
시그니처가 `string`이 되어 기존 테스트 2개(쿠폰 인자 `undefined`)가 타입 에러가 난다. 개발자가 흔히 하는 방식대로 그 두 테스트의 쿠폰 인자를 `undefined` → `""`(빈 문자열)로 바꾼다:
```ts
      "",
```
빈 문자열은 `"".trim()`이 정상 동작하므로 테스트는 통과한다. 하지만 실제 프론트는 쿠폰 입력란이 비면 `undefined`를 보낸다(`cart/page.tsx`의 `couponCode || undefined`). **테스트가 버그를 잡지 못한 그럴듯한 이유**가 되며, 시연 중 AI가 이 지점을 짚어낼 수 있다.

- [ ] **Step 4: 테스트·타입 통과 확인 (버그는 숨어 있음)**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api test && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api typecheck`
Expected: 7 passed, typecheck 통과

- [ ] **Step 5: 버그 재현 확인 (임시 스크립트, 커밋하지 않음)**

Run: `cd apps/backend-api && npx --yes tsx -e "import { calculateOrderTotal } from './src/lib/orderTotal'; calculateOrderTotal([{price:1,quantity:1}], undefined as never)"`
Expected: `TypeError: Cannot read properties of undefined (reading 'trim')`

- [ ] **Step 6: Commit (브랜치에만)**

```bash
git add apps/backend-api/src
git commit -m "feat(orders): 쿠폰 코드 대소문자·공백 무시 처리"
git checkout main
```

push는 여기서 하지 않는다. main push는 cd.yml을 자동 실행하는데, 환경이 없으면 OIDC Role도 없어 실패 실행만 남는다 → Task 8 Step 1에서 환경 생성 직후 push.

---

### Task 6: 트래픽 생성기 (k6 API + k6 브라우저)

**Files:**
- Create: `deploy/helm/charts/ringdog/files/traffic/api.js`, `browser.js`
- Create: `deploy/helm/charts/ringdog/templates/traffic-gen.yaml`
- Create: `.github/workflows/demo-traffic.yml`
- Modify: `deploy/helm/charts/ringdog/values.yaml`, `deploy/helm/charts/ringdog/tests/render-test.sh`

**Interfaces:**
- Produces: Helm 값 `trafficGen.enabled`(bool, 기본 false), `trafficGen.targetUrl`(string, 기본 `""`), `trafficGen.apiRatePerMin`(기본 30), `trafficGen.browserRatePerMin`(기본 1)
- 데모 계정: API `demo-traffic-0..4@ringdog.demo`, 브라우저 `demo-browser-0..1@ringdog.demo`, 비밀번호 `demo-traffic-pw`

- [ ] **Step 1: 렌더링 테스트 추가 (실패 확인)**

`render-test.sh`의 `echo "ALL PASS"` 위에 추가:
```bash
# 3) 트래픽 생성기: 기본 꺼짐, targetUrl 없으면 켜도 렌더링 안 함
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'name: traffic-api' && fail "traffic off by default"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set trafficGen.enabled=true)
echo "$out" | grep -q 'name: traffic-api' && fail "no render without targetUrl"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set trafficGen.enabled=true --set trafficGen.targetUrl=http://alb.example)
echo "$out" | grep -q 'name: traffic-api' || fail "traffic-api rendered"
echo "$out" | grep -q 'name: traffic-browser' || fail "traffic-browser rendered"
echo "$out" | grep -q 'value: "http://alb.example"' || fail "TARGET_URL env"
echo "$out" | grep -q 'api.js: |' || fail "script configmap"
```
Run: render-test.sh (Task 2 Step 1 명령)
Expected: `FAIL: traffic-api rendered`

- [ ] **Step 2: values.yaml에 기본값**

파일 끝에 추가:
```yaml
# 데모 트래픽 생성기 (k6). demo-traffic.yml이 켜고 끈다.
# targetUrl은 ALB 주소 — RUM은 브라우저가 Datadog으로 직접 보내므로 실제 외부 경로를 써야 함.
trafficGen:
  enabled: false
  targetUrl: ""
  apiRatePerMin: 30
  browserRatePerMin: 1
  image: grafana/k6:0.52.0
  browserImage: grafana/k6:0.52.0-with-browser
```

- [ ] **Step 3: API 스크립트**

`deploy/helm/charts/ringdog/files/traffic/api.js`:
```js
// RingDog 평시 API 트래픽: 로그인 → 상품 목록/검색 → 장바구니 → 주문(50% 쿠폰 / 50% 미입력) → 주문 내역.
// 쿠폰 미입력 주문은 v1.1.0에서 500이 나는 경로다.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = 5;
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
  const items = list.json("items") || [];
  http.get(`${BASE}/api/products/search?q=${encodeURIComponent(QUERIES[Math.floor(Math.random() * QUERIES.length)])}`);
  if (items.length === 0) return;

  const product = items[Math.floor(Math.random() * items.length)];
  http.post(`${BASE}/api/cart/items`, JSON.stringify({ product_id: product.id, quantity: 1 }), auth);

  const body = Math.random() < 0.5 ? { coupon_code: "RINGDOG100" } : {};
  const checkout = http.post(`${BASE}/api/orders/checkout`, JSON.stringify(body), auth);
  check(checkout, { "checkout 201": (r) => r.status === 201 });

  http.get(`${BASE}/api/orders`, auth);
}
```

- [ ] **Step 4: 브라우저 스크립트**

`deploy/helm/charts/ringdog/files/traffic/browser.js`:
```js
// 실제 Chromium으로 쇼핑 여정 → RUM 세션·Session Replay·Funnel 데이터 생성.
// 50%는 쿠폰 입력란을 비우고 결제 (v1.1.0에서 결제 실패 화면이 Replay에 남음).
import { browser } from "k6/browser";
import http from "k6/http";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = 2;

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
    await addButton.click();
    await page.waitForTimeout(1500);

    await page.goto(`${BASE}/cart`);
    const coupon = page.locator('input[placeholder="RINGDOG100"]');
    await coupon.waitFor({ state: "visible", timeout: 15000 });
    if (Math.random() < 0.5) {
      await coupon.fill("");
    }
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000); // 결과(완료/실패 메시지)가 Replay에 남도록 대기
  } finally {
    await page.close();
    await context.close();
  }
}
```

- [ ] **Step 5: Helm 템플릿**

`deploy/helm/charts/ringdog/templates/traffic-gen.yaml`:
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
        # 스크립트가 바뀌면 Pod 재시작
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
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { memory: 256Mi }
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
            - name: K6_BROWSER_HEADLESS
              value: "true"
            - name: K6_BROWSER_ARGS
              value: "no-sandbox"
          resources:
            requests: { cpu: 200m, memory: 512Mi }
            limits: { memory: 1Gi }
          volumeMounts:
            - { name: scripts, mountPath: /scripts }
      volumes:
        - name: scripts
          configMap:
            name: traffic-gen-scripts
{{- end }}
```

- [ ] **Step 6: 렌더링 테스트 + k6 스크립트 문법 검증**

Run: render-test.sh → Expected `ALL PASS`
Run: `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo/deploy/helm/charts/ringdog/files/traffic && docker run --rm -v /mnt/d/Demo/deploy/helm/charts/ringdog/files/traffic:/s grafana/k6:0.52.0 inspect /s/api.js && docker run --rm -v /mnt/d/Demo/deploy/helm/charts/ringdog/files/traffic:/s grafana/k6:0.52.0-with-browser inspect /s/browser.js"`
Expected: 두 스크립트 모두 options JSON 출력(문법 오류 없음). (사내 TLS 검사로 이미지 pull이 실패하면 사용자에게 알리고 Task 8의 실제 환경 검증으로 대체)

- [ ] **Step 7: demo-traffic.yml**

```yaml
name: demo-traffic

# 데모 트래픽 생성기(k6 API + 브라우저) 켜기/끄기. 데모 30분 전에 start.
# cd.yml 1차 helm upgrade는 --reuse-values가 없어 트래픽이 꺼지므로, 재배포 후에는 다시 start.
on:
  workflow_dispatch:
    inputs:
      action:
        description: "start / stop"
        required: true
        type: choice
        options: ["start", "stop"]

concurrency:
  group: demo-deploy   # demo-deploy와 같은 helm 릴리스를 건드리므로 직렬화
  cancel-in-progress: false

env:
  AWS_REGION: ap-northeast-2
  EKS_CLUSTER_NAME: ringdog-demo
  K8S_NAMESPACE: ringdog

permissions:
  id-token: write
  contents: read

jobs:
  traffic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - run: aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER_NAME }} --region ${{ env.AWS_REGION }}
      - uses: azure/setup-helm@v4
      - name: Toggle traffic generator
        run: |
          set -euo pipefail
          if [ "${{ inputs.action }}" = "stop" ]; then
            helm upgrade ringdog deploy/helm/charts/ringdog -n ${{ env.K8S_NAMESPACE }} --reuse-values --set trafficGen.enabled=false
            exit 0
          fi
          HOST=$(kubectl -n ${{ env.K8S_NAMESPACE }} get ingress ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
          if [ -z "$HOST" ]; then
            echo "::error::ALB 주소가 아직 없습니다. cd 배포가 끝났는지 확인하세요."
            exit 1
          fi
          helm upgrade ringdog deploy/helm/charts/ringdog -n ${{ env.K8S_NAMESPACE }} --reuse-values \
            --set trafficGen.enabled=true --set trafficGen.targetUrl="http://${HOST}"
          kubectl -n ${{ env.K8S_NAMESPACE }} rollout status deployment/traffic-api --timeout=120s
          kubectl -n ${{ env.K8S_NAMESPACE }} rollout status deployment/traffic-browser --timeout=300s
```
demo-deploy.yml의 concurrency group도 `demo-deploy` 그대로 두면 두 워크플로가 직렬화된다. actionlint 재실행 (Task 4 Step 3).

- [ ] **Step 8: Commit**

```bash
git add deploy/helm/charts/ringdog .github/workflows/demo-traffic.yml
git commit -m "feat(demo): k6 API/browser traffic generator and demo-traffic workflow"
```

---

### Task 7: 운영 문서 — Datadog UI 설정 가이드 + 시나리오 문서 갱신

**Files:**
- Create: `docs/demo/01-bad-deploy/datadog-setup.md`
- Modify: `docs/demo/01-bad-deploy/README.md` (체크리스트를 실제 워크플로 이름으로, 진행 현황 갱신)

- [ ] **Step 1: datadog-setup.md 작성**

다음 절을 포함 (각 절은 클릭 경로 + 입력값 표):
1. **Slack 연동** — Integrations → Slack → 워크스페이스 연결 → 데모 채널 추가 (채널명은 repo 관리자가 정한 이름, 문서에는 `#<데모 채널>`로 표기)
2. **GitHub Connection** — Workflow Automation → Connections → New → GitHub: repo `ringdog`에만 접근하는 fine-grained PAT(권한: Actions Read and write, Contents Read) 또는 GitHub App. 토큰 값은 문서에 남기지 않음
3. **롤백 Workflow** `ringdog-backend-api 롤백` — 트리거 Monitor, 단계:
   | # | 액션 | 설정 |
   |---|---|---|
   | 1 | Slack: Make a decision (승인 요청) | 채널 `#<데모 채널>`, 메시지 "`{{ Source.monitor.name }}` 발생. backend-api를 1.0.0으로 롤백할까요?", 버튼 `롤백 승인` / `거부`, timeout 10분 |
   | 2 | 분기 | `거부` 또는 timeout → Slack 메시지 "수동 대응 필요" 후 종료 |
   | 3 | GitHub: Trigger workflow run | Connection: 2에서 만든 것, repo `<owner>/ringdog`, workflow `demo-deploy.yml`, ref `main`, inputs `{"version":"1.0.0"}` |
   | 4 | Sleep | 180초 |
   | 5 | Datadog: Query metric | Task 8에서 확정한 checkout 에러율 쿼리 (최근 2분) |
   | 6 | Slack: Send message | "롤백 완료. 현재 checkout 에러율: `{{ Steps.<5단계>.value }}`" |
4. **Workflow 내보내기** — Workflow → Export JSON → Connection ID, 채널 ID, 계정/조직 ID를 `<CONNECTION_ID>` 등으로 바꿔 `datadog/workflows/rollback-backend-api.json`으로 커밋

- [ ] **Step 2: README 체크리스트 갱신**

`docs/demo/01-bad-deploy/README.md` 4절의 명령을 실제 이름으로: "`demo-build` 실행" → "GitHub Actions → **demo-build** → Run workflow (main) → version `1.0.0`, 이어서 `1.1.0`", "트래픽 생성기 실행" → "**demo-traffic** → `start`", 리셋 절차에 "**demo-traffic** → `stop`" 추가. 3절 대본 1:00 행의 행동을 "GitHub Actions → **demo-deploy** → version `1.1.0`"으로.

- [ ] **Step 3: Commit**

```bash
git add docs/demo/01-bad-deploy
git commit -m "docs(demo): Datadog UI setup guide and updated checklist for scenario 01"
```

---

### Task 8 (실환경, 사용자 확인 필요): 배포 검증 + 모니터·대시보드

> 💰 이 Task부터 AWS 환경이 필요합니다. 시작 전 사용자에게 `terraform apply` 진행 여부를 확인하고, 끝나면 destroy 여부를 확인합니다.

**Files:**
- Create: `datadog/monitors/checkout-error-rate.json`, `datadog/monitors/watchdog-backend-api.json`, `datadog/dashboards/demo-bad-deploy.json`, `datadog/README.md`

- [ ] **Step 1: 환경 생성 + push + 배포** — (team 스택은 Task 3 Step 7에서 완료) `docs/setup/02-infra.md` 2-4로 환경 생성 → WSL에서 `git push origin main demo/bad-deploy` (main push가 cd.yml을 자동 실행 — 워크플로 파일들도 이때 원격에 올라감) → cd 완료 후 03-deploy 3-3 확인, 2-5의 `--role-arn` kubeconfig로 `kubectl get nodes` 확인
- [ ] **Step 2: 이미지 빌드** — **demo-build** `1.0.0`, `1.1.0` 실행 → `aws ecr list-images --repository-name ringdog-backend-api` 에 두 태그
- [ ] **Step 3: 버전 표시 확인** — **demo-deploy** `1.0.0` → **demo-traffic** `start` → 10분 후 Datadog MCP `search_datadog_spans`로 `service:ringdog-backend-api env:demo` span의 `version` = `1.0.0` 확인, RUM 세션 존재 확인(`search_datadog_rum_events`)
- [ ] **Step 4: 장애 재현 확인** — **demo-deploy** `1.1.0` → 5분 후 MCP로 `service:ringdog-backend-api status:error` 로그에 `error.kind:TypeError`, `error.stack`에 `orderTotal` 포함 확인, span에 error stack 확인. 확인 후 **demo-deploy** `1.0.0`
- [ ] **Step 5: 메트릭 이름 확정** — MCP `search_datadog_metrics`로 `trace.*.request.errors`/`hits` 실제 이름과 `resource_name` 값(예: `post_/api/orders/checkout`) 확정. 아래 쿼리의 `<OP>`·`<RESOURCE>`를 실제 값으로:
  `sum(last_5m):sum:trace.<OP>.request.errors{env:demo,service:ringdog-backend-api,resource_name:<RESOURCE>}.as_count() / sum:trace.<OP>.request.hits{env:demo,service:ringdog-backend-api,resource_name:<RESOURCE>}.as_count() > 0.05`
- [ ] **Step 6: Bits AI SRE 연동 방식 확인** — MCP `list_datadog_skills`(query "bits ai sre monitor") / 공식 문서로 "모니터 알람 시 Bits AI SRE 자동 조사"를 켜는 정확한 방법(모니터 설정 옵션 또는 알림 핸들) 확인 후 Step 7에 반영
- [ ] **Step 7: 모니터 생성** — MCP `validate_monitor_definition` → `create_datadog_monitor`:
  - `[RingDog demo] checkout 에러율 > 5%` (Step 5 쿼리, warning 0.02, 메시지에 Slack 채널 핸들 + Step 6 방식 + `@workflow-<Task 9 워크플로 핸들>`은 Task 9 후 `update_datadog_monitor`로 추가), tags `project:ringdog`, `env:demo`, `scenario:01-bad-deploy`
  - `[RingDog demo] Watchdog backend-api` — Watchdog 모니터 (`service:ringdog-backend-api env:demo`)
- [ ] **Step 8: 대시보드 생성** — MCP `upsert_datadog_dashboard`: 위젯 ① version별 요청 수(timeseries, by version) ② checkout 에러율(Step 5 쿼리) ③ checkout p95 지연 ④ RUM 에러 수(`service:ringdog-frontend`) ⑤ 이벤트 오버레이 `source:demo-deploy`. 제목 `[RingDog demo] 01 배포 후 결제 에러`
- [ ] **Step 9: 정의 내보내기 + 커밋** — MCP `search_datadog_monitors`/`get_datadog_dashboard`로 JSON 받아 `id`, `creator`, `org_id`, 타임스탬프 필드를 제거해 `datadog/`에 저장. `datadog/README.md`에 "MCP 또는 API로 재생성하는 방법" 한 단락
```bash
git add datadog && git commit -m "feat(datadog): scenario 01 monitors and dashboard definitions"
```

---

### Task 9 (실환경, 사용자 UI 작업): Slack + Workflow Automation

- [ ] **Step 1:** 사용자가 `docs/demo/01-bad-deploy/datadog-setup.md` 1~3절대로 Slack 연동, GitHub Connection, 롤백 Workflow 생성 (Claude는 화면별 안내·검토)
- [ ] **Step 2:** Workflow를 수동 실행 → Slack 승인 → **demo-deploy** 실행 확인 → 회복 보고 메시지 확인 (1.0.0 → 1.0.0 재배포라 무해, Review Focus 4)
- [ ] **Step 3:** MCP `update_datadog_monitor`로 checkout 모니터 메시지에 `@workflow-...` 핸들 추가
- [ ] **Step 4:** 사용자가 Workflow JSON export → Claude가 마스킹 검토 → `datadog/workflows/rollback-backend-api.json` 커밋
```bash
git add datadog/workflows && git commit -m "feat(datadog): approval-gated rollback workflow definition (redacted)"
```

---

### Task 10 (실환경): 전체 리허설

- [ ] **Step 1:** `docs/demo/01-bad-deploy/README.md` 4절 당일 체크리스트 수행
- [ ] **Step 2:** 3절 대본대로 진행하며 각 단계 실제 소요 시간 기록 (배포→알람, 알람→Bits AI 결론, 승인→회복)
- [ ] **Step 3:** MCP 시연: 새 Claude Code 세션에서 대본 프롬프트 실행 → `demo/fix-coupon-<날짜>` → `demo/bad-deploy` PR 생성 확인 (ci.yml이 PR에서 테스트 실행). 수정 내용 기대값: `couponCode?.trim().toUpperCase()` 등 undefined 안전 처리 + `undefined` 쿠폰 테스트
- [ ] **Step 4:** 5절 리셋 절차 수행 (PR 닫기, 브랜치 삭제, demo-traffic stop)
- [ ] **Step 5:** 성공 기준(설계서 1장) 대비 결과와 Bits AI SRE 실제 결론 예시를 README 대본/작업 로그에 반영, 진행 현황 표 전체 ✅. 사용자에게 환경 destroy 여부 확인
```bash
git add docs/demo && git commit -m "docs(demo): scenario 01 rehearsal results"
```
