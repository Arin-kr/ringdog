#!/usr/bin/env bash
# Helm 렌더링 회귀 테스트. 사용: bash deploy/helm/charts/ringdog/tests/render-test.sh
set -euo pipefail
CHART="$(cd "$(dirname "$0")/.." && pwd)"
BASE=(--set image.registry=reg.example --set image.tag=abc123 --set secrets.databaseUrl=x --set secrets.jwtSecret=y)
fail() { echo "FAIL: $*"; exit 1; }

# 1) 오버라이드 없음 → backend-api도 sha 태그, DD_VERSION=sha
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'image: reg.example/ringdog-backend-api:abc123' || fail "backend-api default tag"
[ "$(echo "$out" | grep -A1 'name: DD_VERSION' | grep -c 'value: "abc123"')" -eq 3 ] || fail "DD_VERSION=abc123 on 3 backends"
[ "$(echo "$out" | grep -c 'tags.datadoghq.com/version: "abc123"')" -eq 8 ] || fail "version label x8 (4 deployments x 2)"

# 2) backend-api만 1.1.0
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set backendApi.imageTag=1.1.0 --set backendApi.version=1.1.0)
echo "$out" | grep -q 'image: reg.example/ringdog-backend-api:1.1.0' || fail "backend-api override tag"
echo "$out" | grep -q 'image: reg.example/ringdog-frontend:abc123' || fail "frontend keeps global tag"
[ "$(echo "$out" | grep -c 'tags.datadoghq.com/version: "1.1.0"')" -eq 2 ] || fail "backend-api version label x2"

# 3) 모든 앱 컨테이너에 requests, 네임스페이스 LimitRange (기본 메모리 limit 512Mi)
out=$(helm template ringdog "$CHART" "${BASE[@]}")
[ "$(echo "$out" | grep -c '^ *requests:')" -ge 4 ] || fail "requests on 4 app containers"
echo "$out" | grep -q 'kind: LimitRange' || fail "LimitRange rendered"
echo "$out" | grep -A12 'kind: LimitRange' | grep -q 'memory: 512Mi' || fail "LimitRange default memory limit 512Mi"

echo "ALL PASS"
