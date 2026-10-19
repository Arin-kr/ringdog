# 데모 시나리오 ② "배포 후 결제 에러 급증" 구현 계획

> ⚠️ 공통 기반(Task 1·2·3·6 해당 부분)은 시나리오 ① 계획 `2026-10-16-demo-flash-sale-db.md` Task 1·2·3·10에서 구현됨. 이 계획은 ② 전용 Task만 다룬다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** backend-api 문제 버전(v1.1.0) 배포 → Datadog 탐지·AI 분석 → Slack 승인 롤백 → MCP 수정 PR까지 시연 가능한 상태를, 팀원이 repo 문서만으로 재현할 수 있게 만든다.

**Architecture:** main 브랜치에는 관측성 보강(Unified Service Tagging, 에러 로그/스팬 보강), 데모용 GitHub Actions(`demo-build`/`demo-deploy`)를 추가한다. 에러 관측 보강, Unified Service Tagging, k6 트래픽 생성기, 팀 권한 Terraform 스택은 ① 계획에서 이미 만들어 둔 것을 쓴다. 버그 코드는 `demo/bad-deploy` 브랜치에만 둔다. Datadog 모니터·대시보드는 MCP로 만들고 정의를 `datadog/`에 커밋, Workflow는 UI로 만들고 마스킹한 JSON을 커밋한다.

**Tech Stack:** Node 24 / Express / dd-trace 5 / vitest 2, Helm 3, Terraform ≥1.7 (AWS provider ~>5), GitHub Actions, k6 0.52.0 (`k6/browser`), Datadog (APM, Logs, RUM, Watchdog, Bits AI SRE, Workflow Automation, MCP)

**Spec:** [`docs/design/specs/2026-10-13-demo-bad-deploy-design.md`](../specs/2026-10-13-demo-bad-deploy-design.md)
**진행 현황 문서:** [`docs/demo/02-bad-deploy/README.md`](../../demo/02-bad-deploy/README.md) — 각 Task 완료 시 진행 현황 표 갱신

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
2. **알람 반복/중복 승인으로 롤백이 두 번 실행** → `demo-deploy version=1.0.0` 재실행은 무해(idempotent)해야 하고 동시 실행은 직렬화 (Task 4 concurrency 그룹 + Step 4 수동 검증)

---

## 파일 구조

| 파일 | 상태 | 책임 |
|---|---|---|
| `.github/workflows/demo-build.yml` / `demo-deploy.yml` | 생성 | 버전 이미지 빌드 / 버전 교체·롤백 |
| `datadog/monitors/*.json`, `datadog/dashboards/*.json`, `datadog/workflows/*.json` | 생성 | Datadog 설정 정의(마스킹) |
| `docs/setup/*.md`, `docs/demo/02-bad-deploy/*.md` | 수정/생성 | 운영 문서 갱신, Datadog UI 설정 가이드 |

---

### Task 1: backend-api 테스트 기반 + 에러 관측 보강

→ ① 계획 Task 1에서 완료. `calculateOrderTotal`(`apps/backend-api/src/lib/orderTotal.ts`)은 이미 main에 있어 Task 5가 이 함수를 수정한다.

---

### Task 2: Unified Service Tagging + backend-api 버전 오버라이드 + CD 수동 실행

→ ① 계획 Task 2에서 완료. Helm 값 `backendApi.imageTag` / `backendApi.version` 오버라이드도 이미 있어 Task 4(`demo-deploy`)가 `--set`으로 사용한다.

---

### Task 3: 팀 권한 Terraform 스택 + EKS access entry

→ ① 계획 Task 3에서 완료 (팀 권한 스택 `infra/terraform/team`, IAM 그룹 `ringdog-demo-team`, Role `ringdog-demo-eks-admin`).

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
(`$PWD` 이스케이프가 Git Bash에서 깨지면 ① 계획 Task 3 Step 3처럼 스크립트 파일로 실행)
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

→ 시나리오 ① 계획 `2026-10-16-demo-flash-sale-db.md` **Task 10**의 생성기를 그대로 사용한다. 이 계획에서는 `demo-traffic.yml`과 별도 Helm 템플릿을 만들지 않는다.

② 시연 때는 **demo-control** → `start`로 트래픽을 켠 뒤, 쿠폰 혼합 프로필이 필요하면 다음을 실행한다.

```bash
helm upgrade ringdog deploy/helm/charts/ringdog -n ringdog --reset-then-reuse-values --set trafficGen.couponRatio=0.5
```

(`trafficGen.couponRatio`는 ① 생성기에 이미 있는 값이며 기본값 `"0"`은 쿠폰 미사용이다. `--reset-then-reuse-values`는 ①의 평시 트래픽 설정을 유지한 채 이 값만 덮어쓴다.)

---

### Task 7: 운영 문서 — Datadog UI 설정 가이드 + 시나리오 문서 갱신

**Files:**
- Create: `docs/demo/02-bad-deploy/datadog-setup.md`
- Modify: `docs/demo/02-bad-deploy/README.md` (체크리스트를 실제 워크플로 이름으로, 진행 현황 갱신)

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

`docs/demo/02-bad-deploy/README.md` 4절의 명령을 실제 이름으로: "`demo-build` 실행" → "GitHub Actions → **demo-build** → Run workflow (main) → version `1.0.0`, 이어서 `1.1.0`", "트래픽 생성기 실행" → "**demo-control** → `start`", 리셋 절차에 "**demo-control** → `stop`" 추가. 3절 대본 1:00 행의 행동을 "GitHub Actions → **demo-deploy** → version `1.1.0`"으로.

- [ ] **Step 3: Commit**

```bash
git add docs/demo/02-bad-deploy
git commit -m "docs(demo): Datadog UI setup guide and updated checklist for scenario 01"
```

---

### Task 8 (실환경, 사용자 확인 필요): 배포 검증 + 모니터·대시보드

> 💰 이 Task부터 AWS 환경이 필요합니다. 시작 전 사용자에게 `terraform apply` 진행 여부를 확인하고, 끝나면 destroy 여부를 확인합니다.

**Files:**
- Create: `datadog/monitors/checkout-error-rate.json`, `datadog/monitors/watchdog-backend-api.json`, `datadog/dashboards/demo-bad-deploy.json`, `datadog/README.md`

- [ ] **Step 1: 환경 생성 + push + 배포** — (team 스택은 ① 계획 Task 3에서 완료) WSL에서 `bash scripts/demo-up.sh`로 환경 생성(환경이 이미 있으면 생략) → WSL에서 `git push origin main demo/bad-deploy` (main push가 cd.yml을 자동 실행 — 워크플로 파일들도 이때 원격에 올라감) → cd 완료 후 03-deploy 3-3 확인, 2-5의 `--role-arn` kubeconfig로 `kubectl get nodes` 확인
- [ ] **Step 2: 이미지 빌드** — **demo-build** `1.0.0`, `1.1.0` 실행 → `aws ecr list-images --repository-name ringdog-backend-api` 에 두 태그
- [ ] **Step 3: 버전 표시 확인** — **demo-deploy** `1.0.0` → **demo-control** `start`(① 생성기, 평시 프로필) → 10분 후 Datadog MCP `search_datadog_spans`로 `service:ringdog-backend-api env:demo` span의 `version` = `1.0.0` 확인, RUM 세션 존재 확인(`search_datadog_rum_events`)
- [ ] **Step 4: 장애 재현 확인** — **demo-deploy** `1.1.0` → 5분 후 MCP로 `service:ringdog-backend-api status:error` 로그에 `error.kind:TypeError`, `error.stack`에 `orderTotal` 포함 확인, span에 error stack 확인. 확인 후 **demo-deploy** `1.0.0`
- [ ] **Step 5: 메트릭 이름 확정** — MCP `search_datadog_metrics`로 `trace.*.request.errors`/`hits` 실제 이름과 `resource_name` 값(예: `post_/api/orders/checkout`) 확정. 아래 쿼리의 `<OP>`·`<RESOURCE>`를 실제 값으로:
  `sum(last_5m):sum:trace.<OP>.request.errors{env:demo,service:ringdog-backend-api,resource_name:<RESOURCE>}.as_count() / sum:trace.<OP>.request.hits{env:demo,service:ringdog-backend-api,resource_name:<RESOURCE>}.as_count() > 0.05`
- [ ] **Step 6: Bits AI SRE 연동 방식 확인** — MCP `list_datadog_skills`(query "bits ai sre monitor") / 공식 문서로 "모니터 알람 시 Bits AI SRE 자동 조사"를 켜는 정확한 방법(모니터 설정 옵션 또는 알림 핸들) 확인 후 Step 7에 반영
- [ ] **Step 7: 모니터 생성** — MCP `validate_monitor_definition` → `create_datadog_monitor`:
  - `[RingDog demo] checkout 에러율 > 5%` (Step 5 쿼리, warning 0.02, 메시지에 Slack 채널 핸들 + Step 6 방식 + `@workflow-<Task 9 워크플로 핸들>`은 Task 9 후 `update_datadog_monitor`로 추가), tags `project:ringdog`, `env:demo`, `scenario:02-bad-deploy`
  - `[RingDog demo] Watchdog backend-api` — Watchdog 모니터 (`service:ringdog-backend-api env:demo`)
- [ ] **Step 8: 대시보드 생성** — MCP `upsert_datadog_dashboard`: 위젯 ① version별 요청 수(timeseries, by version) ② checkout 에러율(Step 5 쿼리) ③ checkout p95 지연 ④ RUM 에러 수(`service:ringdog-frontend`) ⑤ 이벤트 오버레이 `source:demo-deploy`. 제목 `[RingDog demo] 01 배포 후 결제 에러`
- [ ] **Step 9: 정의 내보내기 + 커밋** — MCP `search_datadog_monitors`/`get_datadog_dashboard`로 JSON 받아 `id`, `creator`, `org_id`, 타임스탬프 필드를 제거해 `datadog/`에 저장. `datadog/README.md`에 "MCP 또는 API로 재생성하는 방법" 한 단락
```bash
git add datadog && git commit -m "feat(datadog): scenario 01 monitors and dashboard definitions"
```

---

### Task 9 (실환경, 사용자 UI 작업): Slack + Workflow Automation

- [ ] **Step 1:** 사용자가 `docs/demo/02-bad-deploy/datadog-setup.md` 1~3절대로 Slack 연동, GitHub Connection, 롤백 Workflow 생성 (Claude는 화면별 안내·검토)
- [ ] **Step 2:** Workflow를 수동 실행 → Slack 승인 → **demo-deploy** 실행 확인 → 회복 보고 메시지 확인 (1.0.0 → 1.0.0 재배포라 무해, Review Focus 4)
- [ ] **Step 3:** MCP `update_datadog_monitor`로 checkout 모니터 메시지에 `@workflow-...` 핸들 추가
- [ ] **Step 4:** 사용자가 Workflow JSON export → Claude가 마스킹 검토 → `datadog/workflows/rollback-backend-api.json` 커밋
```bash
git add datadog/workflows && git commit -m "feat(datadog): approval-gated rollback workflow definition (redacted)"
```

---

### Task 10 (실환경): 전체 리허설

- [ ] **Step 1:** `docs/demo/02-bad-deploy/README.md` 4절 당일 체크리스트 수행
- [ ] **Step 2:** 3절 대본대로 진행하며 각 단계 실제 소요 시간 기록 (배포→알람, 알람→Bits AI 결론, 승인→회복)
- [ ] **Step 3:** MCP 시연: 새 Claude Code 세션에서 대본 프롬프트 실행 → `demo/fix-coupon-<날짜>` → `demo/bad-deploy` PR 생성 확인 (ci.yml이 PR에서 테스트 실행). 수정 내용 기대값: `couponCode?.trim().toUpperCase()` 등 undefined 안전 처리 + `undefined` 쿠폰 테스트
- [ ] **Step 4:** 5절 리셋 절차 수행 (PR 닫기, 브랜치 삭제, demo-control stop)
- [ ] **Step 5:** 성공 기준(설계서 1장) 대비 결과와 Bits AI SRE 실제 결론 예시를 README 대본/작업 로그에 반영, 진행 현황 표 전체 ✅. 사용자에게 환경 destroy 여부 확인
```bash
git add docs/demo && git commit -m "docs(demo): scenario 01 rehearsal results"
```
