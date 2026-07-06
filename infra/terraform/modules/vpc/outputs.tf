output "vpc_id" {
  description = "ID of the RingDog VPC."
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (ALB, NAT Gateway)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (EKS nodes, RDS, MSK, OpenSearch)."
  value       = aws_subnet.private[*].id
}

output "nat_gateway_id" {
  description = "ID of the single shared NAT Gateway."
  value       = aws_nat_gateway.this.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC."
  value       = aws_vpc.this.cidr_block
}
