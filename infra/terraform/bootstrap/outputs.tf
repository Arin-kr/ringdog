output "state_bucket_name" {
  description = "Name of the S3 bucket created for Terraform remote state. Copy into envs/demo/backend.tf `bucket` if it differs from the default."
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_arn" {
  description = "ARN of the Terraform state S3 bucket."
  value       = aws_s3_bucket.tfstate.arn
}

output "lock_table_name" {
  description = "Name of the DynamoDB table created for Terraform state locking. Copy into envs/demo/backend.tf `dynamodb_table` if it differs from the default."
  value       = aws_dynamodb_table.tfstate_lock.name
}
