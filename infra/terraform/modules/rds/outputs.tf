output "endpoint" {
  description = "Connection endpoint (host:port) for the RDS instance."
  value       = aws_db_instance.this.endpoint
}

output "address" {
  description = "Hostname of the RDS instance (without port)."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "Port the RDS instance listens on."
  value       = aws_db_instance.this.port
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret holding {username, password, host, port, dbname}."
  value       = aws_secretsmanager_secret.db.arn
}

output "security_group_id" {
  description = "ID of the RDS security group."
  value       = aws_security_group.rds.id
}
