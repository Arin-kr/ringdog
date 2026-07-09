# RingDog IAM / IRSA module
#
# Two independent concerns live here:
#   (a) IRSA (IAM Roles for Service Accounts) roles that let specific
#       Kubernetes ServiceAccounts in the `ringdog` namespace assume
#       least-privilege IAM roles via the EKS cluster's OIDC provider.
#   (b) A separate GitHub Actions OIDC provider + role so CI/CD can push to
#       ECR and deploy to EKS without long-lived AWS access keys, per the
#       PRD's `ci_cd_pipeline.aws_resources_used` (AWS IAM OIDC for GitHub
#       Actions).

data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "${var.project_name}-${var.environment}"
}

# ==========================================================================
# (a) IRSA roles for application service accounts
# ==========================================================================

# --- backend-api: Secrets Manager (RDS credentials) only -----------------

data "aws_iam_policy_document" "backend_api_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_url}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${var.service_account_names["backend_api"]}"]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backend_api" {
  name               = "${local.name}-backend-api-irsa"
  assume_role_policy = data.aws_iam_policy_document.backend_api_trust.json
  tags               = var.tags
}

data "aws_iam_policy_document" "backend_api_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.rds_secret_arn]
  }
}

resource "aws_iam_role_policy" "backend_api" {
  name   = "${local.name}-backend-api-secrets"
  role   = aws_iam_role.backend_api.id
  policy = data.aws_iam_policy_document.backend_api_permissions.json
}

# --- chatbot-service: Secrets Manager (RDS) + Bedrock InvokeModel --------

data "aws_iam_policy_document" "chatbot_service_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_url}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${var.service_account_names["chatbot_service"]}"]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "chatbot_service" {
  name               = "${local.name}-chatbot-service-irsa"
  assume_role_policy = data.aws_iam_policy_document.chatbot_service_trust.json
  tags               = var.tags
}

data "aws_iam_policy_document" "chatbot_service_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.rds_secret_arn]
  }

  statement {
    effect  = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/${var.bedrock_model_id}",
    ]
  }
}

resource "aws_iam_role_policy" "chatbot_service" {
  name   = "${local.name}-chatbot-service-secrets-bedrock"
  role   = aws_iam_role.chatbot_service.id
  policy = data.aws_iam_policy_document.chatbot_service_permissions.json
}

# --- order-consumer: Secrets Manager (RDS credentials) only ---------------

data "aws_iam_policy_document" "order_consumer_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_url}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${var.service_account_names["order_consumer"]}"]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "order_consumer" {
  name               = "${local.name}-order-consumer-irsa"
  assume_role_policy = data.aws_iam_policy_document.order_consumer_trust.json
  tags               = var.tags
}

data "aws_iam_policy_document" "order_consumer_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.rds_secret_arn]
  }
}

resource "aws_iam_role_policy" "order_consumer" {
  name   = "${local.name}-order-consumer-secrets"
  role   = aws_iam_role.order_consumer.id
  policy = data.aws_iam_policy_document.order_consumer_permissions.json
}

# ==========================================================================
# (b) GitHub Actions OIDC provider + deploy role
# ==========================================================================
#
# Thumbprints below are GitHub's documented OIDC token endpoint
# intermediate CA thumbprints. AWS now validates GitHub's OIDC provider
# against its public certificate chain regardless of the configured
# thumbprint, but the argument remains required by the provider resource.

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  tags = var.tags
}

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Demo scope: allow the main branch push (CD) and any pull_request (CI
    # plan-only) workflow run from the configured repo. Narrow further
    # (e.g. to a specific environment/tag) before any non-demo use.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:ref:refs/heads/main",
        "repo:${var.github_repo}:pull_request",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "ringdog-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
  tags               = var.tags
}

# Intentionally broad for a demo (ECR push across all repos + EKS describe
# for `aws eks update-kubeconfig`). Narrow to specific repository ARNs /
# cluster ARN before any non-demo use.
#
# Also grants read access to the handful of resources CD needs to resolve
# deploy-time config (DB creds, JWT secret, MSK brokers, OpenSearch
# endpoint, the per-service IRSA role ARNs) by fixed resource name at
# deploy time, instead of that config living in GitHub Secrets that go
# stale every destroy/apply cycle. AWS_ROLE_ARN itself is the one value
# that can't be resolved this way (it's needed before any AWS credentials
# exist) and stays a GitHub Secret.
data "aws_iam_policy_document" "github_actions_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    effect  = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = ["*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["eks:DescribeCluster"]
    resources = ["*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.rds_secret_arn, var.jwt_secret_arn]
  }

  # ListClustersV2 has no resource-level permissions (must be "*"); it's how
  # CD turns the fixed cluster *name* into the cluster ARN it needs for
  # GetBootstrapBrokers below.
  statement {
    effect    = "Allow"
    actions   = ["kafka:ListClustersV2"]
    resources = ["*"]
  }

  statement {
    effect  = "Allow"
    actions = ["kafka:GetBootstrapBrokers"]
    resources = [
      "arn:${data.aws_partition.current.partition}:kafka:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:cluster/${var.msk_cluster_name}/*",
    ]
  }

  statement {
    effect  = "Allow"
    actions = ["es:DescribeDomain"]
    resources = [
      "arn:${data.aws_partition.current.partition}:es:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:domain/${var.opensearch_domain_name}",
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "ringdog-github-actions-deploy-policy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_permissions.json
}

# Grant GitHub Actions kubectl/helm access via EKS Access Entries (K8s 1.23+).
resource "aws_eks_access_entry" "github_actions" {
  count = var.eks_cluster_name != "" ? 1 : 0

  cluster_name  = var.eks_cluster_name
  principal_arn = aws_iam_role.github_actions_deploy.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "github_actions" {
  count = var.eks_cluster_name != "" ? 1 : 0

  cluster_name  = var.eks_cluster_name
  principal_arn = aws_iam_role.github_actions_deploy.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.github_actions]
}
