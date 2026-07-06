variable "cluster_name" {
  description = "MSK cluster name."
  type        = string
  default     = "ringdog-demo"
}

variable "vpc_id" {
  description = "VPC ID the MSK brokers and their security group live in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the MSK broker nodes. number_of_broker_nodes must be a multiple of length(private_subnet_ids)."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to reach the Kafka broker ports (typically the EKS node/cluster SG)."
  type        = list(string)
}

variable "kafka_version" {
  description = "Apache Kafka version."
  type        = string
  default     = "3.6.0"
}

variable "number_of_broker_nodes" {
  description = "Number of broker nodes. Demo cost tradeoff: 2 (one per AZ) instead of a larger production cluster. Must be a multiple of the number of AZs used."
  type        = number
  default     = 2
}

variable "instance_type" {
  description = "MSK broker instance type. Demo cost tradeoff: kafka.t3.small instead of production-sized kafka.m5.* brokers."
  type        = string
  default     = "kafka.t3.small"
}

variable "ebs_volume_size" {
  description = "EBS volume size (GB) per broker."
  type        = number
  default     = 20
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
