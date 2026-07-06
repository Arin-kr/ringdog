output "jwt_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the JWT signing key."
  value       = aws_secretsmanager_secret.jwt.arn
}
