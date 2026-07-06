output "service_account_role_arns" {
  description = "Map of app key -> IRSA IAM role ARN, for annotating each Kubernetes ServiceAccount (eks.amazonaws.com/role-arn)."
  value = {
    backend_api     = aws_iam_role.backend_api.arn
    chatbot_service = aws_iam_role.chatbot_service.arn
    order_consumer  = aws_iam_role.order_consumer.arn
  }
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions deploy role (set as the GitHub Secret AWS_ROLE_ARN)."
  value       = aws_iam_role.github_actions_deploy.arn
}

output "github_actions_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider."
  value       = aws_iam_openid_connect_provider.github_actions.arn
}
