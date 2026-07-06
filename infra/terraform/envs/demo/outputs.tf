output "vpc_id" {
  value = module.vpc.vpc_id
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_oidc_provider_arn" {
  value = module.eks.oidc_provider_arn
}

output "ecr_repository_urls" {
  description = "Map of app name -> ECR repository URL."
  value       = module.ecr.repository_urls
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_secret_arn" {
  description = "Secrets Manager ARN holding {username, password, host, port, dbname}."
  value       = module.rds.secret_arn
}

output "msk_bootstrap_brokers" {
  value = module.msk.bootstrap_brokers
}

output "msk_bootstrap_brokers_tls" {
  value = module.msk.bootstrap_brokers_tls
}

output "opensearch_domain_endpoint" {
  value = module.opensearch.domain_endpoint
}

output "jwt_secret_arn" {
  value = module.secrets.jwt_secret_arn
}

output "service_account_role_arns" {
  description = "Map of app key -> IRSA IAM role ARN, for Kubernetes ServiceAccount annotations."
  value       = module.iam_irsa.service_account_role_arns
}

output "github_actions_role_arn" {
  description = "ARN to configure as the GitHub Secret AWS_ROLE_ARN for CI/CD OIDC auth."
  value       = module.iam_irsa.github_actions_role_arn
}
