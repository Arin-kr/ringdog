#!/usr/bin/env bash
# 시나리오 ① 환경 내리기: 트래픽 끄기 → Ingress 삭제(ALB 정리 대기) → terraform destroy → 남은 리소스 확인.
# Ingress가 만든 ALB는 Terraform 밖이라, 먼저 지우지 않으면 VPC 삭제가 막힌다.
# 사용 (WSL): bash scripts/demo-down.sh [--yes]
set -euo pipefail
# shellcheck source=scripts/lib-demo-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-demo-env.sh"
# shellcheck disable=SC2034  # confirm()이 lib에서 읽는다
YES="${1:-}"

remove_alb() {
  if ! aws eks describe-cluster --name "$CLUSTER" --region "$REGION" >/dev/null 2>&1; then
    echo "클러스터가 없어 ALB 정리를 건너뜁니다"
    return 0
  fi
  update_kubeconfig
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
