# --- Core --------------------------------------------------------------

variable "project_name" {
  description = "Project name, used as a prefix/tag across all resources."
  type        = string
  default     = "ringdog"
}

variable "environment" {
  description = "Environment name, used as a prefix/tag across all resources."
  type        = string
  default     = "demo"
}

variable "aws_region" {
  description = "AWS region to deploy RingDog into."
  type        = string
  default     = "ap-northeast-2"
}

variable "github_repo" {
  description = "GitHub repository (\"org/name\") allowed to assume the GitHub Actions OIDC deploy role. Set this to your real fork/repo before applying."
  type        = string
  default     = "your-org/ringdog"
}

# --- Networking ----------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the RingDog VPC."
  type        = string
  default     = "10.60.0.0/16"
}

variable "azs" {
  description = "Availability zones to use. Demo cost tradeoff: 2 AZs instead of 3."
  type        = list(string)
  default     = ["ap-northeast-2a", "ap-northeast-2c"]
}

# --- EKS -------------------------------------------------------------

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "ringdog-demo"
}

variable "k8s_version" {
  description = "Kubernetes version for the EKS control plane."
  type        = string
  default     = "1.29"
}

variable "node_instance_types" {
  description = "Instance types for the EKS managed node group. Demo cost tradeoff: t3.medium."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_min_size" {
  type    = number
  default = 1
}

variable "node_max_size" {
  type    = number
  default = 3
}

variable "node_desired_size" {
  type    = number
  default = 2
}

# --- RDS -------------------------------------------------------------

variable "rds_instance_class" {
  description = "RDS instance class. Demo cost tradeoff: db.t3.micro."
  type        = string
  default     = "db.t3.micro"
}

variable "rds_db_name" {
  type    = string
  default = "ringdog"
}

variable "rds_username" {
  type    = string
  default = "ringdog"
}

# --- MSK -------------------------------------------------------------

variable "msk_instance_type" {
  description = "MSK broker instance type. Demo cost tradeoff: kafka.t3.small."
  type        = string
  default     = "kafka.t3.small"
}

variable "msk_number_of_broker_nodes" {
  description = "Number of MSK broker nodes. Must be a multiple of length(var.azs)."
  type        = number
  default     = 2
}

# --- OpenSearch --------------------------------------------------------

variable "opensearch_domain_name" {
  type    = string
  default = "ringdog-products"
}

variable "opensearch_instance_type" {
  description = "OpenSearch node instance type. Demo cost tradeoff: t3.small.search, single node."
  type        = string
  default     = "t3.small.search"
}

# --- ECR -------------------------------------------------------------

variable "ecr_repository_names" {
  description = "ECR repository names, one per RingDog app."
  type        = list(string)
  default = [
    "ringdog-frontend",
    "ringdog-backend-api",
    "ringdog-chatbot-service",
    "ringdog-order-consumer",
  ]
}

# --- IRSA / Kubernetes ---------------------------------------------------

variable "k8s_namespace" {
  description = "Kubernetes namespace the RingDog apps deploy into."
  type        = string
  default     = "ringdog"
}

variable "service_account_names" {
  description = "Map of app key -> Kubernetes ServiceAccount name, for IRSA trust policies."
  type        = map(string)
  default = {
    backend_api     = "backend-api"
    chatbot_service = "chatbot-service"
    order_consumer  = "order-consumer"
  }
}

variable "bedrock_model_id" {
  description = "Bedrock foundation model id the chatbot-service may invoke (demo default: Claude 3 Haiku)."
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
}
