output "cluster_name" {
  description = "Name of the EKS cluster."
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint."
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded certificate authority data for the cluster."
  value       = aws_eks_cluster.this.certificate_authority[0].data
}

output "oidc_provider_arn" {
  description = "ARN of the IAM OIDC provider for the cluster, used for IRSA trust policies."
  value       = aws_iam_openid_connect_provider.this.arn
}

output "oidc_provider_url" {
  description = "URL (without https://) of the cluster's OIDC issuer, used for IRSA trust policies."
  value       = replace(aws_eks_cluster.this.identity[0].oidc[0].issuer, "https://", "")
}

output "node_role_arn" {
  description = "ARN of the IAM role used by EKS worker nodes."
  value       = aws_iam_role.node.arn
}

output "cluster_security_group_id" {
  description = "ID of the EKS cluster's primary security group, used to grant node-originated access to RDS/MSK/OpenSearch."
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}
