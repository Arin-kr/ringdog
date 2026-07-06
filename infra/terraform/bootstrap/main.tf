# RingDog Terraform bootstrap stack
#
# This stack creates the S3 bucket + DynamoDB table that envs/demo (and any
# future envs/*) use as a remote backend. It is intentionally the ONE stack
# in this repo that does NOT use a remote backend itself (chicken-and-egg
# problem: something has to create the backend before it can be used) — its
# own state is kept local, in bootstrap/terraform.tfstate.
#
# Run this once per AWS account, before running `terraform init` in
# envs/demo. See ../README.md for the full apply order.

terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Intentionally no `backend` block here — local state only.
}

provider "aws" {
  region = var.aws_region
}

# --- Remote state bucket -----------------------------------------------

resource "aws_s3_bucket" "tfstate" {
  # NOTE: bucket names are globally unique across ALL AWS accounts. The
  # default below (ringdog-tfstate-demo) is likely already taken. Set
  # `state_bucket_name` to something unique (e.g. suffix your account id)
  # and remember to update envs/demo/backend.tf to match.
  bucket = var.state_bucket_name

  # Cost note: an S3 bucket for state is effectively free at this scale
  # (a handful of small state files) - no cost tradeoff made here.

  tags = merge(var.tags, {
    Name = var.state_bucket_name
  })
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- Lock table -----------------------------------------------------------

resource "aws_dynamodb_table" "tfstate_lock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST" # cost note: no capacity to size for a low-traffic lock table

  hash_key = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(var.tags, {
    Name = var.lock_table_name
  })
}
