{{- define "ringdog.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "ringdog.fullname" -}}
{{- printf "%s" (include "ringdog.name" .) }}
{{- end }}

{{- define "ringdog.labels" -}}
app.kubernetes.io/name: {{ include "ringdog.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "ringdog.image" -}}
{{- $registry := required "image.registry is required" .Values.image.registry -}}
{{- $repo := .repo -}}
{{- $tag := default .Values.image.tag .tag -}}
{{ printf "%s/%s:%s" $registry $repo $tag }}
{{- end }}

{{/*
Datadog Unified Service Tagging labels. Usage:
  include "ringdog.ddLabels" (dict "env" .Values.datadog.env "service" "ringdog-backend-api" "version" $version)
*/}}
{{- define "ringdog.ddLabels" -}}
tags.datadoghq.com/env: {{ .env | quote }}
tags.datadoghq.com/service: {{ .service | quote }}
tags.datadoghq.com/version: {{ .version | quote }}
{{- end }}
