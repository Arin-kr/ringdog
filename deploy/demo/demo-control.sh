#!/usr/bin/env bash
# 시나리오 ① 시연 조작. .github/workflows/demo-control.yml이 실행한다.
# 사용: demo-control.sh <seed|start|spike|inject|mitigate|fix-index|reset|stop> [widget|session]
#   mitigate만 두 번째 인자를 쓴다: widget = 1차 대처(위젯 OFF), session = 2차 대처(배치 세션 종료 + 안전 모드 재실행)
#   seed / mitigate session / fix-index / reset은 DB_HOST·DB_USER·DB_PASS·DB_NAME 환경변수가 필요하다 (워크플로가 넣어 줌)
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NS="${K8S_NAMESPACE:-ringdog}"
CHART="$DEMO_DIR/../helm/charts/ringdog"

# batch_job_name <fault|safe> → Job 이름. 삭제도 이 이름으로만 한다 (fault 삭제가 safe를 지우지 않게, 그 반대도)
# fault → inventory-batch (이름으로 원인이 드러나지 않게), safe → inventory-batch-safe
batch_job_name() {
  if [ "$1" = "fault" ]; then echo "inventory-batch"; else echo "inventory-batch-safe"; fi
}

# render_batch_job <fault|safe> <image> → Job YAML (stdout)
render_batch_job() {
  local mode="$1" image="$2" delay deadline job_name
  job_name=$(batch_job_name "$mode")
  if [ "$mode" = "fault" ]; then
    delay=180
    deadline=2580
  else
    delay=0
    deadline=600
  fi
  sed -e "s|__JOB_NAME__|${job_name}|g" \
      -e "s|__MODE__|${mode}|g" \
      -e "s|__IMAGE__|${image}|g" \
      -e "s|__VERSION__|${image##*:}|g" \
      -e "s|__DELAY__|${delay}|g" \
      -e "s|__DEADLINE__|${deadline}|g" \
      "$DEMO_DIR/inventory-batch-job.yaml"
}

# check_batch_image <image> → 그대로 출력. repo:<tag> 형태만 허용한다.
# 태그(${image##*:})가 tags.datadoghq.com/version 라벨이 되므로 다이제스트(@sha256:...)·태그 없음·63자 초과는 거부.
check_batch_image() {
  local image="$1" last tag
  if [[ "$image" == *@* ]]; then
    echo "::error::배치 이미지가 다이제스트 형식입니다 (repo:<tag> 필요): $image" >&2
    return 1
  fi
  last="${image##*/}"
  if [[ "$last" != *:* ]]; then
    echo "::error::배치 이미지에 태그가 없습니다 (repo:<tag> 필요): $image" >&2
    return 1
  fi
  tag="${last##*:}"
  if [ -z "$tag" ] || [ "${#tag}" -gt 63 ]; then
    echo "::error::배치 이미지 태그가 비었거나 63자를 넘습니다 (version 라벨 불가): $image" >&2
    return 1
  fi
  echo "$image"
}

# traffic_args <normal|spike> <target-url> → helm --set 인자 (stdout, 한 줄에 하나)
traffic_args() {
  local profile="$1" url="$2"
  echo "--set=trafficGen.enabled=true"
  echo "--set=trafficGen.targetUrl=${url}"
  if [ "$profile" = "spike" ]; then
    echo "--set=trafficGen.apiRatePerMin=240"
    echo "--set=trafficGen.apiUsers=40"
    echo "--set=trafficGen.checkoutRatio=0.25"
    echo "--set=trafficGen.trendingRatio=0.5"
    echo "--set=trafficGen.ordersRatio=0.1"
  else
    echo "--set=trafficGen.apiRatePerMin=30"
    echo "--set=trafficGen.apiUsers=5"
    echo "--set=trafficGen.checkoutRatio=1"
    echo "--set=trafficGen.trendingRatio=1"
    echo "--set=trafficGen.ordersRatio=1"
  fi
}

# alb_url → http://<ALB 주소>. 없으면 실패한다.
# 호출 쪽은 반드시 url=$(alb_url)로 먼저 받는다 — <(...)나 인자 안의 $(...)에서는 실패가 묻혀
# 빈 targetUrl로 helm upgrade가 돌고 트래픽이 조용히 꺼진다.
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

# helm_traffic <normal|spike> [추가 helm 인자...] — 트래픽 프로필을 바꾼다 (ALB 주소 확인 후)
helm_traffic() {
  local profile="$1" url
  shift
  url=$(alb_url)
  local -a args
  mapfile -t args < <(traffic_args "$profile" "$url")
  helm_set "${args[@]}" "$@"
}

restart_backend() {
  kubectl -n "$NS" rollout restart deployment/backend-api
  kubectl -n "$NS" rollout status deployment/backend-api --timeout=300s
}

# psql_run <sql-file> — 일회성 psql Pod (LimitRange가 기본 requests를 준다)
psql_run() {
  : "${DB_HOST:?DB_HOST required}" "${DB_USER:?DB_USER required}" \
    "${DB_PASS:?DB_PASS required}" "${DB_NAME:?DB_NAME required}"
  kubectl -n "$NS" run "demo-psql-$(date +%s)" --rm -i --restart=Never \
    --image=postgres:16-alpine --env="PGPASSWORD=${DB_PASS}" --command -- \
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f - < "$1"
}

backend_image() {
  kubectl -n "$NS" get deployment backend-api -o jsonpath='{.spec.template.spec.containers[0].image}'
}

# delete_batch_job <fault|safe> — 해당 모드의 Job만 이름으로 지운다
delete_batch_job() {
  kubectl -n "$NS" delete job "$(batch_job_name "$1")" --ignore-not-found --wait=true
}

start_batch() {
  local mode="$1" raw image
  raw=$(backend_image)
  image=$(check_batch_image "$raw")
  delete_batch_job "$mode"
  render_batch_job "$mode" "$image" | kubectl apply -f -
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
      helm_traffic normal
      ;;
    spike)
      helm_traffic spike
      ;;
    inject)
      helm_traffic spike --set=featureFlags.trendingWidget=true
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
          # 끊긴 장애 모드 배치 Job 정리 (backoffLimit 0이라 다시 뜨지는 않음). 이름 지정이라 safe Job은 건드리지 않는다.
          delete_batch_job fault
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
      # 두 모드 모두 지운다 (app=inventory-batch 라벨은 fault·safe Job에만 있음)
      kubectl -n "$NS" delete job -l app=inventory-batch --ignore-not-found --wait=true
      psql_run "$DEMO_DIR/sql/reset.sql"
      helm_traffic normal --set=featureFlags.trendingWidget=false
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
