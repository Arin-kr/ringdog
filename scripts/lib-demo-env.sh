#!/usr/bin/env bash
# shellcheck disable=SC2034  # 변수는 source하는 스크립트에서 사용
# demo-up.sh / demo-down.sh 공통. WSL에서 실행한다 (aws/terraform/kubectl/gh/helm 필요).
# Terraform은 /mnt/d가 아닌 WSL 내부 복사본에서 실행 (provider 로딩 timeout 회피).

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${TF_WORK_DIR:-$HOME/tf-work-ringdog}"
TF_DIR="$WORK/infra/terraform/envs/demo"
REGION=ap-northeast-2
CLUSTER=ringdog-demo
NS=ringdog
EKS_ADMIN_ROLE=ringdog-demo-eks-admin

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

# kubeconfig 갱신. 팀 공용 역할(ringdog-demo-eks-admin)이 있으면 그 역할로, 없으면 현재 자격 증명(클러스터 생성자만 가능)으로.
# 계정 ID/ARN은 저장하지 않고 매번 조회한다.
update_kubeconfig() {
  local arn
  arn=$(aws iam get-role --role-name "$EKS_ADMIN_ROLE" --query Role.Arn --output text 2>/dev/null || true)
  if [ -n "$arn" ] && [ "$arn" != "None" ]; then
    aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION" --role-arn "$arn" >/dev/null
  else
    echo "알림: 역할 $EKS_ADMIN_ROLE 이(가) 없어 현재 자격 증명으로 kubeconfig를 만듭니다 (클러스터 생성자만 접근 가능)"
    aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION" >/dev/null
  fi
}
