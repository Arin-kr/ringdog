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
# 권한은 데모 단순화를 위해 AWS 관리형 ReadOnlyAccess (Datadog 문서의 최소 권한 정책 대신).
# ReadOnlyAccess에는 S3 객체·시크릿·파라미터·로그 이벤트·큐 메시지 등 데이터 평면 읽기가 포함되므로,
# 아래 인라인 정책(datadog_deny_data_reads)으로 해당 읽기를 명시적으로 Deny한다.
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

# ReadOnlyAccess가 허용하는 데이터 평면 읽기(tfstate 버킷의 시크릿 등)를 Deny — 명시적 Deny가 Allow보다 우선.
data "aws_iam_policy_document" "datadog_deny_data_reads" {
  count = var.datadog_external_id == "" ? 0 : 1

  statement {
    effect = "Deny"
    actions = [
      "s3:GetObject*",
      "secretsmanager:GetSecretValue",
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
      "kms:Decrypt",
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "ssm:GetParameterHistory",
      "lambda:GetFunction",
      "ec2:GetPasswordData",
      "dynamodb:PartiQLSelect",
      "dynamodb:ExecuteStatement",
      "dynamodb:BatchExecuteStatement",
      "logs:GetLogEvents",
      "logs:StartQuery",
      "codecommit:GetFile",
      "codecommit:GetBlob",
      "athena:GetQueryResults",
      "kinesis:GetRecords",
      "sqs:ReceiveMessage",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "datadog_deny_data_reads" {
  count  = var.datadog_external_id == "" ? 0 : 1
  name   = "deny-data-plane-reads"
  role   = aws_iam_role.datadog_integration[0].id
  policy = data.aws_iam_policy_document.datadog_deny_data_reads[0].json
}
