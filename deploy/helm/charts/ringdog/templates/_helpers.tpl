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
