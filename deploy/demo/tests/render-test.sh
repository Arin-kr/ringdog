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
echo "$out" | grep -q 'batch-mode: fault' || fail "batch-mode label fault"
echo "$out" | grep -q 'application_name=inventory-batch' || fail "application_name"
echo "$out" | grep -q 'tags.datadoghq.com/version: "abc123"' || fail "UST version from image tag"
echo "$out" | grep -q 'image: reg.example/ringdog-backend-api:abc123' || fail "image"

out=$(render_batch_job safe reg.example/ringdog-backend-api:abc123)
echo "$out" | grep -qx '  name: inventory-batch-safe' || fail "safe job name"
echo "$out" | grep -q 'batch-mode: safe' || fail "batch-mode label safe"
echo "$out" | grep -q 'activeDeadlineSeconds: 600' || fail "safe deadline"
echo "$out" | grep -q 'sleep 0 ' || fail "safe starts immediately"
echo "$out" | grep -q '__' && fail "unreplaced placeholder"
echo "$out" | grep -q 'terminationGracePeriodSeconds: 5' || fail "fast pod deletion (sh PID 1 ignores SIGTERM)"

# helm 인자 조합 (실제 helm 실행 없이 함수 출력만 검사)
targs=$(traffic_args spike http://alb.example)
echo "$targs" | grep -q 'trafficGen.apiRatePerMin=240' || fail "spike rate"
echo "$targs" | grep -q 'trafficGen.checkoutRatio=0.25' || fail "spike checkout ratio"
echo "$targs" | grep -q 'trafficGen.trendingRatio=0.35' || fail "spike trending ratio"
echo "$targs" | grep -q 'trafficGen.ordersRatio=0.1' || fail "spike orders ratio"
targs=$(traffic_args normal http://alb.example)
echo "$targs" | grep -q 'trafficGen.apiRatePerMin=30' || fail "normal rate"
echo "$targs" | grep -q 'trafficGen.trendingRatio=1' || fail "normal trending ratio"
echo "$targs" | grep -q 'trafficGen.ordersRatio=1' || fail "normal orders ratio"
echo "$targs" | grep -q 'trafficGen.targetUrl=http://alb.example' || fail "target url"
grep -q "pg_terminate_backend" "$DIR/sql/terminate-batch-blockers.sql" || fail "kill sql"
grep -q "application_name = 'inventory-batch'" "$DIR/sql/terminate-batch-blockers.sql" || fail "kill only the batch"
grep -q "to_regclass('public.demo_price_backup')" "$DIR/sql/reset.sql" || fail "reset guard for fresh env"
grep -qi "create index concurrently" "$DIR/sql/apply-index.sql" && fail "fix-index must not use CONCURRENTLY (hangs behind the batch transaction)"
grep -q "orders_created_at_idx" "$DIR/sql/apply-index.sql" || fail "fix-index creates the same index reset drops"
grep -q "orders_created_at_idx" "$DIR/sql/reset.sql" || fail "reset drops fix-index index"

# 이미지 가드: 다이제스트(@sha256:...)는 version 라벨이 될 수 없으므로 거부
check_batch_image reg.example/ringdog-backend-api:abc123 >/dev/null || fail "tag image accepted"
( check_batch_image reg.example/ringdog-backend-api@sha256:deadbeef >/dev/null 2>&1 ) && fail "digest image must be rejected"
( check_batch_image reg.example/ringdog-backend-api >/dev/null 2>&1 ) && fail "untagged image must be rejected"
( check_batch_image reg.example:5000/ringdog-backend-api >/dev/null 2>&1 ) && fail "registry port is not a tag"
# fault/safe Job 삭제는 서로를 건드리지 않는다 (이름이 정확히 지정됨)
[ "$(batch_job_name fault)" = "inventory-batch" ] || fail "fault job name helper"
[ "$(batch_job_name safe)" = "inventory-batch-safe" ] || fail "safe job name helper"

# ALB 주소가 없으면 helm을 아예 실행하지 않는다 (빈 targetUrl로 트래픽이 조용히 꺼지는 것 방지).
# kubectl/helm은 가짜 함수, 별도 bash에서 set -e 그대로 실행한다.
run_stubbed() {
  local host="$1"
  shift
  bash -c 'source "$1"; STUB_HOST="$2"; shift 2
    kubectl() { echo "$STUB_HOST"; }
    helm() { echo "HELM $*"; }
    "$@"' _ "$DIR/demo-control.sh" "$host" "$@" 2>&1
}
rc=0; out=$(run_stubbed "" helm_traffic normal) || rc=$?
[ "$rc" -ne 0 ] || fail "helm_traffic must fail without ALB url"
echo "$out" | grep -q '^HELM' && fail "helm must not run without ALB url"
out=$(run_stubbed alb.example helm_traffic spike --set=featureFlags.trendingWidget=true)
echo "$out" | grep -q 'trafficGen.targetUrl=http://alb.example' || fail "helm gets ALB url"
echo "$out" | grep -q 'trafficGen.apiRatePerMin=240' || fail "helm gets spike profile"
echo "$out" | grep -q 'featureFlags.trendingWidget=true' || fail "extra helm args passed through"

echo "ALL PASS"
