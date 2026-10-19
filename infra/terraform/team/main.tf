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
