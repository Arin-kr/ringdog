# RingDog OpenSearch module
#
# Cost/complexity tradeoffs vs. production:
#   - Single node (`instance_count = 1`), no dedicated master nodes, no
#     multi-AZ standby. A production search cluster should use >= 3 data
#     nodes across AZs (plus dedicated masters) for availability.
#   - `t3.small.search` burstable instance instead of a production
#     memory/CPU-optimized instance class.
#   - The access policy below uses `Principal = "*"`. This is only
#     acceptable because the domain has NO public endpoint — it is deployed
#     inside a private VPC subnet with `vpc_options`, so network-level
#     access is already restricted to the VPC/security group. In
#     production, scope the Principal to specific IAM roles even inside a
#     VPC, for defense in depth.

locals {
  name = "${var.project_name}-${var.environment}"
}

resource "aws_security_group" "opensearch" {
  name        = "${local.name}-opensearch-sg"
  description = "Allow HTTPS access to OpenSearch from EKS nodes only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name}-opensearch-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  # Keyed by static index rather than toset(value) — the security group IDs
  # here are themselves outputs of resources created in this same apply
  # (e.g. the EKS cluster SG), so their values are unknown at plan time and
  # a set derived from them can't be used as a for_each key.
  for_each = { for idx, sg_id in var.allowed_security_group_ids : tostring(idx) => sg_id }

  security_group_id            = aws_security_group.opensearch.id
  referenced_security_group_id = each.value
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
  description                  = "HTTPS from EKS node/cluster SG"
}

resource "aws_vpc_security_group_egress_rule" "all_out" {
  security_group_id = aws_security_group.opensearch.id
  cidr_ipv4          = "0.0.0.0/0"
  ip_protocol        = "-1"
}

resource "aws_opensearch_domain" "this" {
  domain_name    = var.domain_name
  engine_version = var.engine_version

  cluster_config {
    instance_type  = var.instance_type
    instance_count = 1
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = var.ebs_volume_size
  }

  vpc_options {
    subnet_ids         = [var.private_subnet_ids[0]] # single node -> single subnet
    security_group_ids = [aws_security_group.opensearch.id]
  }

  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https = true
  }

  tags = merge(var.tags, {
    Name = var.domain_name
  })
}

resource "aws_opensearch_domain_policy" "this" {
  domain_name = aws_opensearch_domain.this.domain_name

  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "*" } # acceptable only because the domain is VPC-private, see module header
      Action    = "es:*"
      Resource  = "${aws_opensearch_domain.this.arn}/*"
    }]
  })
}
