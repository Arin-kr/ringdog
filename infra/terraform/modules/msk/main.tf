# RingDog MSK module
#
# Cost/complexity tradeoffs vs. production:
#   - `instance_type = kafka.t3.small` (burstable, cheapest broker size)
#     instead of production-sized kafka.m5.large+.
#   - `number_of_broker_nodes = 2` (one per AZ, the minimum for any
#     redundancy) instead of 3+ per AZ for higher throughput/durability.
#   - `client_broker = "TLS_PLAINTEXT"` allows plaintext connections from
#     inside the VPC so kafkajs (backend-api/order-consumer) doesn't need
#     extra TLS client configuration for a demo. Production should use
#     `TLS` only, plus SASL/IAM auth.

locals {
  name = "${var.project_name}-${var.environment}"
}

resource "aws_security_group" "msk" {
  name        = "${local.name}-msk-sg"
  description = "Allow Kafka broker access from EKS nodes only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name}-msk-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "kafka_plaintext" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.msk.id
  referenced_security_group_id = each.value
  from_port                    = 9092
  to_port                      = 9092
  ip_protocol                  = "tcp"
  description                  = "Kafka plaintext from EKS node/cluster SG"
}

resource "aws_vpc_security_group_ingress_rule" "kafka_tls" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.msk.id
  referenced_security_group_id = each.value
  from_port                    = 9094
  to_port                      = 9094
  ip_protocol                  = "tcp"
  description                  = "Kafka TLS from EKS node/cluster SG"
}

resource "aws_vpc_security_group_egress_rule" "all_out" {
  security_group_id = aws_security_group.msk.id
  cidr_ipv4          = "0.0.0.0/0"
  ip_protocol        = "-1"
}

resource "aws_msk_cluster" "this" {
  cluster_name           = var.cluster_name
  kafka_version           = var.kafka_version
  number_of_broker_nodes  = var.number_of_broker_nodes

  broker_node_group_info {
    instance_type   = var.instance_type
    client_subnets  = var.private_subnet_ids
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.ebs_volume_size
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS_PLAINTEXT" # demo simplicity, see module header
      in_cluster    = true
    }
  }

  tags = merge(var.tags, {
    Name = var.cluster_name
  })
}
