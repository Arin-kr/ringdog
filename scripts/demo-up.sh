#!/usr/bin/env bash
# 시나리오 ① 환경 올리기: terraform apply → cd 배포(마이그레이션·대량 시드·DBM·Agent·앱·평시 트래픽) → 확인.
# 사용 (WSL): bash scripts/demo-up.sh [--yes]   약 30~40분. 세션이 끊겨도 살도록 setsid nohup 권장.
set -euo pipefail
# shellcheck source=scripts/lib-demo-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-demo-env.sh"
# shellcheck disable=SC2034  # confirm()이 lib에서 읽는다
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
  host=""
  for _ in $(seq 1 30); do
    host=$(kubectl -n "$NS" get ingress ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
    [ -n "$host" ] && break
    sleep 10
  done
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
  update_kubeconfig
  run_cd
  verify
}

main
