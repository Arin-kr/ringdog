locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# --- Networking ----------------------------------------------------------

module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr     = var.vpc_cidr
  azs          = var.azs
  cluster_name = var.cluster_name
  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

# --- EKS (needs VPC outputs) -----------------------------------------

module "eks" {
  source = "../../modules/eks"

  cluster_name        = var.cluster_name
  k8s_version         = var.k8s_version
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  node_instance_types = var.node_instance_types
  node_min_size       = var.node_min_size
  node_max_size       = var.node_max_size
  node_desired_size   = var.node_desired_size
  project_name        = var.project_name
  environment         = var.environment
  tags                = local.common_tags
}

# --- Data stores (need VPC + EKS node/cluster SG outputs) -------------

module "rds" {
  source = "../../modules/rds"

  identifier                 = var.cluster_name
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  allowed_security_group_ids = [module.eks.cluster_security_group_id]
  instance_class             = var.rds_instance_class
  db_name                    = var.rds_db_name
  username                   = var.rds_username
  project_name               = var.project_name
  environment                = var.environment
  tags                       = local.common_tags
}

module "msk" {
  source = "../../modules/msk"

  cluster_name               = var.cluster_name
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  allowed_security_group_ids = [module.eks.cluster_security_group_id]
  instance_type              = var.msk_instance_type
  number_of_broker_nodes     = var.msk_number_of_broker_nodes
  project_name               = var.project_name
  environment                = var.environment
  tags                       = local.common_tags
}

module "opensearch" {
  source = "../../modules/opensearch"

  domain_name                = var.opensearch_domain_name
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  allowed_security_group_ids = [module.eks.cluster_security_group_id]
  instance_type              = var.opensearch_instance_type
  project_name               = var.project_name
  environment                = var.environment
  tags                       = local.common_tags
}

# --- ECR -------------------------------------------------------------

module "ecr" {
  source = "../../modules/ecr"

  repository_names = var.ecr_repository_names
  tags             = local.common_tags
}

# --- IRSA (needs EKS OIDC provider output + RDS secret) ----------------

module "iam_irsa" {
  source = "../../modules/iam-irsa"

  oidc_provider_arn      = module.eks.oidc_provider_arn
  oidc_provider_url      = module.eks.oidc_provider_url
  namespace              = var.k8s_namespace
  service_account_names  = var.service_account_names
  rds_secret_arn         = module.rds.secret_arn
  jwt_secret_arn         = module.secrets.jwt_secret_arn
  msk_cluster_name       = var.cluster_name
  opensearch_domain_name = var.opensearch_domain_name
  bedrock_model_id       = var.bedrock_model_id
  github_repo            = var.github_repo
  # Reference the module output (not var.cluster_name) so Terraform sees the
  # implicit dependency on aws_eks_cluster.this — otherwise the access entry
  # resources below race the cluster's creation and fail with "No cluster
  # found for name" when applied in the same run.
  eks_cluster_name = module.eks.cluster_name
  project_name     = var.project_name
  environment      = var.environment
  tags             = local.common_tags
}

# --- App secrets ---------------------------------------------------------

module "secrets" {
  source = "../../modules/secrets"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}
