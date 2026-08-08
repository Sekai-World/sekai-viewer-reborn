{{/*
Expand the name of the chart.
*/}}
{{- define "sekai-viewer-reborn.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a release-scoped base name for the chart resources.
*/}}
{{- define "sekai-viewer-reborn.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Give each application a distinct, release-scoped Kubernetes object name. The
48-character base leaves room for the longest application name in values.yaml.
*/}}
{{- define "sekai-viewer-reborn.appName" -}}
{{- $root := index . 0 -}}
{{- $appName := index . 1 -}}
{{- $baseName := include "sekai-viewer-reborn.fullname" $root | trunc 48 | trimSuffix "-" -}}
{{- printf "%s-%s" $baseName $appName | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Selector labels are shared by the Deployment, Service, Ingress, and PDB.
*/}}
{{- define "sekai-viewer-reborn.selectorLabels" -}}
{{- $root := index . 0 -}}
{{- $appName := index . 1 -}}
app.kubernetes.io/name: {{ $appName | quote }}
app.kubernetes.io/instance: {{ $root.Release.Name | quote }}
{{- end }}

{{/*
Common Kubernetes application labels.
*/}}
{{- define "sekai-viewer-reborn.labels" -}}
{{- $root := index . 0 -}}
{{- $appName := index . 1 -}}
helm.sh/chart: {{ printf "%s-%s" $root.Chart.Name $root.Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" | quote }}
{{ include "sekai-viewer-reborn.selectorLabels" (list $root $appName) }}
app.kubernetes.io/version: {{ $root.Chart.AppVersion | quote }}
app.kubernetes.io/component: web
app.kubernetes.io/part-of: {{ include "sekai-viewer-reborn.name" $root | quote }}
app.kubernetes.io/managed-by: {{ $root.Release.Service | quote }}
{{- end }}
