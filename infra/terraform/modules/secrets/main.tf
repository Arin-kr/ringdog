# RingDog application secrets module
#
# Holds app-level secrets that are NOT tied to a specific data store (unlike
# the RDS master credentials, which are generated/stored by modules/rds).
# Currently just the JWT signing secret used by backend-api for
# auth/authorization, per the PRD's `technology_stack.secrets`.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

locals {
  name = "${var.project_name}-${var.environment}"
}

resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name        = "${local.name}/app/jwt-secret"
  description = "RingDog backend-api JWT signing secret for ${var.environment}"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt_secret.result
}
