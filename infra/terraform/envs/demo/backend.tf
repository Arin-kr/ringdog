# Remote state backend for envs/demo.
#
# This bucket + table are created by ../../bootstrap (run once, with local
# state, before this stack's first `terraform init`). The values below MUST
# match whatever bootstrap actually created:
#   - `bucket`: S3 bucket names are globally unique across ALL AWS accounts.
#     If you changed `state_bucket_name` away from the bootstrap default
#     ("ringdog-tfstate-demo") because it was already taken, update `bucket`
#     here to match the real bucket name, or `terraform init` will fail.
#   - `dynamodb_table`: same idea, must match bootstrap's `lock_table_name`.
#
# Terraform does not allow variables in a `backend` block, so these are
# hardcoded literals kept in sync by hand with bootstrap/variables.tf.

terraform {
  backend "s3" {
    bucket         = "ringdog-tfstate-demo"
    key            = "envs/demo/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "ringdog-tfstate-lock"
    encrypt        = true
  }
}
