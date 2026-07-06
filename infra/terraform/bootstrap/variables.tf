variable "aws_region" {
  description = "AWS region for the Terraform remote-state backend resources."
  type        = string
  default     = "ap-northeast-2"
}

variable "state_bucket_name" {
  description = <<-EOT
    Name of the S3 bucket used to store Terraform remote state for envs/demo.
    S3 bucket names are GLOBALLY UNIQUE across all AWS accounts, so this default
    will very likely already be taken. If you change it, you MUST also update
    the `bucket` value in envs/demo/backend.tf to match, or `terraform init`
    there will fail / point at the wrong bucket.
  EOT
  type        = string
  default     = "ringdog-tfstate-demo"
}

variable "lock_table_name" {
  description = <<-EOT
    Name of the DynamoDB table used for Terraform state locking. If changed,
    also update the `dynamodb_table` value in envs/demo/backend.tf to match.
  EOT
  type        = string
  default     = "ringdog-tfstate-lock"
}

variable "tags" {
  description = "Common tags applied to bootstrap resources."
  type        = map(string)
  default = {
    Project     = "ringdog"
    Environment = "demo"
    ManagedBy   = "terraform-bootstrap"
  }
}
