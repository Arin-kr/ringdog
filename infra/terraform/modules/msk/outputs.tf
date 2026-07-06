output "bootstrap_brokers" {
  description = "Plaintext bootstrap broker connection string (host:port,host:port,...)."
  value       = aws_msk_cluster.this.bootstrap_brokers
}

output "bootstrap_brokers_tls" {
  description = "TLS bootstrap broker connection string."
  value       = aws_msk_cluster.this.bootstrap_brokers_tls
}

output "cluster_arn" {
  description = "ARN of the MSK cluster."
  value       = aws_msk_cluster.this.arn
}

output "security_group_id" {
  description = "ID of the MSK security group."
  value       = aws_security_group.msk.id
}
