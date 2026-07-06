variable "identifier" {
  description = "RDS instance identifier."
  type        = string
  default     = "ringdog-demo"
}

variable "vpc_id" {
  description = "VPC ID the RDS instance and its security group live in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the DB subnet group."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to reach Postgres on 5432 (typically the EKS node/cluster SG)."
  type        = list(string)
}

variable "instance_class" {
  description = "RDS instance class. Demo cost tradeoff: db.t3.micro instead of a production-sized multi-AZ instance."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Allocated storage (GB) for the RDS instance."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "ringdog"
}

variable "username" {
  description = "Master username for the RDS instance."
  type        = string
  default     = "ringdog"
}

variable "engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16"
}

variable "multi_az" {
  description = "Whether to enable Multi-AZ. Demo cost tradeoff: false (single-AZ) to avoid doubling RDS cost; production should set this true."
  type        = bool
  default     = false
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
