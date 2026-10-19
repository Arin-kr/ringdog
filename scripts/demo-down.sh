#!/usr/bin/env bash
# 시나리오 ① 환경 내리기: 트래픽 끄기 → Ingress 삭제(ALB 정리 대기) → terraform destroy → 남은 리소스 확인.
# Ingress가 만든 ALB는 Terraform 밖이라, 먼저 지우지 않으면 VPC 삭제가 막힌다.
# 사용 (WSL): bash scripts/demo-down.sh [--yes]
set -euo pipefail
# shellcheck source=scripts/lib-demo-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-demo-env.sh"
# shellcheck disable=SC2034  # confirm()이 lib에서 읽는다
YES="${1:-}"

cluster_exists() {
  local err
  if err=$(aws eks describe-cluster --name "$CLUSTER" --region "$REGION" 2>&1 >/dev/null); then
    return 0
  fi
  case "$err" in
    *ResourceNotFoundException*) return 1 ;;
    *) fail "클러스터 상태를 확인하지 못했습니다 (자격 증명·throttling 확인): $err" ;;
  esac
}

# Ingress가 만든 ALB·target group·security group 중 남은 것을 출력한다 (없으면 빈 문자열).
# $(...) 안에서는 errexit가 꺼지므로 aws 실패를 return 1로 넘기고, 호출부가 fail한다
# (실패를 빈 문자열 = "다 지워짐"으로 오판하지 않게).
lb_leftovers() {
  local lbs tgs sgs
  lbs=$(aws elbv2 describe-load-balancers --region "$REGION" \
    --query "LoadBalancers[?starts_with(LoadBalancerName, 'k8s-ringdog')].LoadBalancerName" --output text) || return 1
  tgs=$(aws elbv2 describe-target-groups --region "$REGION" \
    --query "TargetGroups[?starts_with(TargetGroupName, 'k8s-ringdog')].TargetGroupName" --output text) || return 1
  sgs=$(aws ec2 describe-security-groups --region "$REGION" \
    --filters "Name=tag:elbv2.k8s.aws/cluster,Values=$CLUSTER" \
    --query "SecurityGroups[].GroupId" --output text) || return 1
  echo "${lbs} ${tgs} ${sgs}" | xargs
}

remove_alb() {
  if ! cluster_exists; then
    echo "클러스터가 없어 ALB 정리를 건너뜁니다"
    return 0
  fi
  update_kubeconfig
  helm upgrade ringdog "$REPO/deploy/helm/charts/ringdog" -n "$NS" --reset-then-reuse-values \
    --set trafficGen.enabled=false >/dev/null 2>&1 || true
  kubectl -n "$NS" delete ingress ringdog --ignore-not-found --wait=true --timeout=5m \
    || echo "경고: Ingress 삭제가 5분 안에 끝나지 않았습니다. ALB 삭제 여부를 직접 확인하며 계속합니다"
  local left=""
  for _ in $(seq 1 40); do
    left=$(lb_leftovers) || fail "ALB·target group·보안 그룹 조회에 실패했습니다 (자격 증명·throttling 확인)"
    [ -z "$left" ] && return 0
    echo "ALB·target group·보안 그룹 삭제 대기 중: $left"
    sleep 15
  done
  fail "ALB 관련 리소스가 10분 안에 지워지지 않았습니다: $left"
}

rds_exists() {
  local err
  if err=$(aws rds describe-db-instances --db-instance-identifier ringdog-demo --region "$REGION" 2>&1 >/dev/null); then
    return 0
  fi
  case "$err" in
    *DBInstanceNotFound*) return 1 ;;
    *) fail "RDS 상태를 확인하지 못했습니다 (자격 증명·throttling 확인): $err" ;;
  esac
}

verify_gone() {
  local state
  state=$(terraform -chdir="$TF_DIR" state list) || fail "Terraform state를 읽지 못했습니다"
  [ -z "$state" ] || fail "Terraform state에 리소스가 남아 있습니다"
  # 조회 오류를 "없음"으로 오판하지 않게 NotFound만 삭제 완료로 본다
  if cluster_exists; then fail "EKS 클러스터가 남아 있습니다"; fi
  if rds_exists; then fail "RDS가 남아 있습니다"; fi
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
