variable "datadog_external_id" {
  description = "Datadog AWS 통합 타일(Integrations → AWS → Add account → Manually)이 발급한 External ID. 비우면 Datadog 연동 Role을 만들지 않는다. public repo이므로 값은 gitignore된 team/terraform.tfvars에만 둔다."
  type        = string
  default     = ""
  sensitive   = true
}
