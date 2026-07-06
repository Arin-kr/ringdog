output "domain_endpoint" {
  description = "HTTPS endpoint of the OpenSearch domain (no scheme)."
  value       = aws_opensearch_domain.this.endpoint
}

output "domain_arn" {
  description = "ARN of the OpenSearch domain."
  value       = aws_opensearch_domain.this.arn
}

output "security_group_id" {
  description = "ID of the OpenSearch security group."
  value       = aws_security_group.opensearch.id
}
