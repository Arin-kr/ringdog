variable "repository_names" {
  description = "List of ECR repository names to create, one per RingDog app."
  type        = list(string)
  default = [
    "ringdog-frontend",
    "ringdog-backend-api",
    "ringdog-chatbot-service",
    "ringdog-order-consumer",
  ]
}

variable "untagged_image_expiry_days" {
  description = "Number of days after which untagged images are expired by the lifecycle policy."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Common tags applied to all repositories."
  type        = map(string)
  default     = {}
}
