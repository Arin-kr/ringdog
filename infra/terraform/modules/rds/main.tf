# RingDog RDS module
#
# Cost/complexity tradeoffs vs. production:
#   - `multi_az = false` (single instance, no standby) — halves RDS cost but
#     means a maintenance event or AZ outage causes downtime.
#   - `instance_class = db.t3.micro` — burstable/small, fine for demo traffic.
#   - `skip_final_snapshot = true` — no final snapshot on destroy, so
#     `terraform destroy` fully tears the DB down with no leftover cost, but
#     also means no recovery snapshot. Acceptable for a throwaway demo.
#   - We manage the master password ourselves via `random_password` +
#     Secrets Manager (rather than `manage_master_user_password = true`)
#     so that we can store host/port/dbname alongside it as a single JSON
#     secret for easy `DATABASE_URL` construction by app pods via IRSA.

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

resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-rds-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${local.name}-rds-subnet-group"
  })
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds-sg"
  description = "Allow Postgres access from EKS nodes only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name}-rds-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "postgres" {
  # Keyed by static index rather than toset(value) — the security group IDs
  # here are themselves outputs of resources created in this same apply
  # (e.g. the EKS cluster SG), so their values are unknown at plan time and
  # a set derived from them can't be used as a for_each key.
  for_each = { for idx, sg_id in var.allowed_security_group_ids : tostring(idx) => sg_id }

  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = each.value
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "Postgres from EKS node/cluster SG"
}

resource "aws_vpc_security_group_egress_rule" "all_out" {
  security_group_id = aws_security_group.rds.id
  cidr_ipv4          = "0.0.0.0/0"
  ip_protocol        = "-1"
}

resource "random_password" "master" {
  length  = 24
  special = false # avoid characters that need extra escaping in connection strings / JSON
}

resource "aws_db_instance" "this" {
  identifier     = var.identifier
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type       = "gp3"

  db_name  = var.db_name
  username = var.username
  password = random_password.master.result
  # Managing the password ourselves (see module header) instead of:
  # manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = var.multi_az
  publicly_accessible = false
  skip_final_snapshot = true # demo only, see module header

  tags = merge(var.tags, {
    Name = var.identifier
  })
}

# --- Secrets Manager: single JSON secret for the whole DATABASE_URL ------

resource "aws_secretsmanager_secret" "db" {
  name        = "${local.name}/rds/credentials"
  description = "RingDog RDS PostgreSQL credentials (username, password, host, port, dbname) for ${var.environment}"
  # This is a throwaway demo secret recreated on every destroy/apply cycle
  # (see module header) — skip the recovery window so the next `apply`
  # isn't blocked by the previous `destroy`'s pending deletion.
  recovery_window_in_days = 0

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  secret_string = jsonencode({
    username = var.username
    password = random_password.master.result
    host     = aws_db_instance.this.address
    port     = aws_db_instance.this.port
    dbname   = var.db_name
  })
}
