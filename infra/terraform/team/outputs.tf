output "team_group_name" {
  value = aws_iam_group.team.name
}

output "eks_admin_role_name" {
  value = aws_iam_role.eks_admin.name
}

output "datadog_integration_role_name" {
  value = try(aws_iam_role.datadog_integration[0].name, "")
}
