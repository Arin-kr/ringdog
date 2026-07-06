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
