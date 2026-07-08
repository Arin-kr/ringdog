variable "oidc_provider_arn" {
  description = "ARN of the EKS cluster's IAM OIDC provider (from the eks module), used to trust Kubernetes service accounts."
  type        = string
}

variable "oidc_provider_url" {
  description = "URL (without https://) of the EKS cluster's OIDC issuer (from the eks module)."
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace the RingDog apps deploy into."
  type        = string
  default     = "ringdog"
}

variable "service_account_names" {
  description = "Map of app key -> Kubernetes ServiceAccount name, used to scope each IRSA role's trust policy `sub` condition."
  type        = map(string)
  default = {
    backend_api      = "backend-api"
    chatbot_service  = "chatbot-service"
    order_consumer   = "order-consumer"
  }
}

variable "rds_secret_arn" {
  description = "ARN of the Secrets Manager secret holding RDS credentials (from the rds module), granted to backend-api/chatbot-service/order-consumer."
  type        = string
}

variable "bedrock_model_id" {
  description = <<-EOT
    Bedrock foundation model id the chatbot-service is allowed to invoke.
    Default is Claude 3 Haiku, chosen in the PRD for demo cost/latency.
    NOTE: Bedrock model availability varies by region; verify Claude Haiku
    is enabled/available in your target region before relying on this.
  EOT
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
}

variable "github_repo" {
  description = "GitHub repo (\"org/name\") allowed to assume the GitHub Actions deploy role, e.g. \"your-org/ringdog\"."
  type        = string
  default     = "your-org/ringdog"
}

variable "project_name" {
  description = "Project name used in resource names/tags."
  type        = string
  default     = "ringdog"
}

variable "environment" {
  description = "Environment name used in resource names/tags."
  type        = string
  default     = "demo"
}

variable "tags" {
  description = "Common tags applied to all resources in this module."
  type        = map(string)
  default     = {}
}

variable "eks_cluster_name" {
  description = "EKS cluster name — when set, grants the GitHub Actions deploy role cluster-admin via EKS Access Entries."
  type        = string
  default     = ""
}
