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
    # 계정 root 신뢰는 의도적: 그룹 멤버는 이미 AdministratorAccess를 가지며(데모 범위), 개별 사용자 ARN을 repo에 남기지 않기 위함.
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

# Datadog 문서의 AWS 통합 권한 목록 기반 allow-only 인라인 정책.
# 데모에서 쓰는 서비스(EKS/EC2/ELB/RDS/MSK/OpenSearch/ECR/S3 메타데이터)로 한정했고,
# 데이터 평면 읽기(S3 객체, 시크릿, 로그 내용 등)는 포함하지 않는다.
# Datadog 타일이 권한 부족을 알리면 여기에 액션을 추가한다.
data "aws_iam_policy_document" "datadog_permissions" {
  count = var.datadog_external_id == "" ? 0 : 1

  statement {
    effect = "Allow"
    actions = [
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "cloudwatch:Describe*",
      "ec2:Describe*",
      "autoscaling:Describe*",
      "elasticloadbalancing:Describe*",
      "rds:Describe*",
      "rds:List*",
      "kafka:Describe*",
      "kafka:List*",
      "es:Describe*",
      "es:List*",
      "eks:Describe*",
      "eks:List*",
      "ecr:Describe*",
      "s3:ListAllMyBuckets",
      "s3:GetBucketLocation",
      "s3:GetBucketTagging",
      "s3:GetBucketLogging",
      "s3:GetBucketNotification",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:DescribeSubscriptionFilters",
      "tag:GetResources",
      "tag:GetTagKeys",
      "tag:GetTagValues",
      "health:DescribeEvents",
      "health:DescribeEventDetails",
      "health:DescribeAffectedEntities",
      "budgets:ViewBudget",
      "support:DescribeTrustedAdvisor*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "datadog_permissions" {
  count  = var.datadog_external_id == "" ? 0 : 1
  name   = "datadog-integration-permissions"
  role   = aws_iam_role.datadog_integration[0].id
  policy = data.aws_iam_policy_document.datadog_permissions[0].json
}
