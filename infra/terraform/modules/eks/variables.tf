variable "cluster_name" {
  description = "Name of the EKS cluster."
  type        = string
  default     = "ringdog-demo"
}

variable "k8s_version" {
  description = "Kubernetes version for the EKS control plane."
  type        = string
  default     = "1.29"
}

variable "vpc_id" {
  description = "VPC ID the cluster and node group live in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the managed node group (and cluster ENIs)."
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs, included in cluster vpc_config for the (optional) public endpoint / ALB Ingress."
  type        = list(string)
}

variable "node_instance_types" {
  description = "Instance types for the managed node group. Demo cost tradeoff: small t3.medium nodes instead of production-sized compute-optimized instances."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_min_size" {
  description = "Minimum number of nodes in the managed node group."
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of nodes in the managed node group."
  type        = number
  default     = 3
}

variable "node_desired_size" {
  description = "Desired number of nodes in the managed node group."
  type        = number
  default     = 2
}

variable "node_disk_size" {
  description = "Root EBS volume size (GB) for worker nodes."
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
