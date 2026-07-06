variable "domain_name" {
  description = "OpenSearch domain name."
  type        = string
  default     = "ringdog-products"
}

variable "vpc_id" {
  description = "VPC ID the OpenSearch domain and its security group live in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs to choose the (single) OpenSearch subnet from. Only the first is used, since instance_count = 1."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to reach OpenSearch on 443 (typically the EKS node/cluster SG)."
  type        = list(string)
}

variable "instance_type" {
  description = "OpenSearch data node instance type. Demo cost tradeoff: t3.small.search single node instead of a production multi-node, dedicated-master cluster."
  type        = string
  default     = "t3.small.search"
}

variable "ebs_volume_size" {
  description = "EBS volume size (GB) for the single OpenSearch node."
  type        = number
  default     = 10
}

variable "engine_version" {
  description = "OpenSearch engine version."
  type        = string
  default     = "OpenSearch_2.15"
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
