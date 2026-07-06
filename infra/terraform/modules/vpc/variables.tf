variable "vpc_cidr" {
  description = "CIDR block for the RingDog VPC."
  type        = string
  default     = "10.60.0.0/16"
}

variable "azs" {
  description = <<-EOT
    Availability zones to spread subnets across. Demo cost tradeoff: 2 AZs
    instead of the production-grade 3, to keep the (single) NAT Gateway and
    subnet count minimal while still giving EKS/RDS/MSK the AZ redundancy
    they require to even schedule/create resources.
  EOT
  type        = list(string)
  default     = ["ap-northeast-2a", "ap-northeast-2c"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets, one per AZ in var.azs."
  type        = list(string)
  default     = ["10.60.0.0/20", "10.60.16.0/20"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets, one per AZ in var.azs."
  type        = list(string)
  default     = ["10.60.128.0/20", "10.60.144.0/20"]
}

variable "cluster_name" {
  description = "EKS cluster name, used for the required `kubernetes.io/cluster/<name>` subnet tags."
  type        = string
  default     = "ringdog-demo"
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
