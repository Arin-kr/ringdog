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

# 4) 플래그 ConfigMap + backend-api가 읽음, 기본 OFF
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'name: ringdog-feature-flags' || fail "feature flag configmap"
echo "$out" | grep -q 'FEATURE_TRENDING_WIDGET: "false"' || fail "flag off by default"
echo "$out" | grep -A3 'name: FEATURE_TRENDING_WIDGET' | grep -q 'configMapKeyRef' || fail "backend-api reads flag from configmap"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set featureFlags.trendingWidget=true)
echo "$out" | grep -q 'FEATURE_TRENDING_WIDGET: "true"' || fail "flag on"

# 5) HPA 1→4, HPA가 켜지면 Deployment에 replicas를 두지 않음 (helm upgrade가 HPA를 덮어쓰지 않게)
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'kind: HorizontalPodAutoscaler' || fail "hpa rendered"
echo "$out" | grep -q 'maxReplicas: 4' || fail "hpa max 4"
echo "$out" | awk '/^kind: Deployment/{d=0} /name: backend-api$/{d=1} d&&/replicas:/{print; exit}' | grep -q . && fail "backend-api replicas must be omitted with HPA"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set backendApi.hpa.enabled=false)
echo "$out" | grep -q 'kind: HorizontalPodAutoscaler' && fail "hpa off"

# 6) 트래픽 생성기: 기본 꺼짐, targetUrl 없으면 켜도 렌더링 안 함
out=$(helm template ringdog "$CHART" "${BASE[@]}")
echo "$out" | grep -q 'name: traffic-api' && fail "traffic off by default"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set trafficGen.enabled=true)
echo "$out" | grep -q 'name: traffic-api' && fail "no render without targetUrl"
out=$(helm template ringdog "$CHART" "${BASE[@]}" --set trafficGen.enabled=true --set trafficGen.targetUrl=http://alb.example \
  --set trafficGen.apiRatePerMin=240 --set trafficGen.apiUsers=40 --set trafficGen.checkoutRatio=0.25 --set trafficGen.trendingRatio=0.25 --set trafficGen.ordersRatio=0.1)
echo "$out" | grep -q 'name: traffic-api' || fail "traffic-api rendered"
echo "$out" | grep -q 'name: traffic-browser' || fail "traffic-browser rendered"
echo "$out" | grep -q 'value: "http://alb.example"' || fail "TARGET_URL env"
echo "$out" | grep -A1 'name: RATE_PER_MIN' | grep -q 'value: "240"' || fail "spike rate"
echo "$out" | grep -A1 'name: USERS' | grep -q 'value: "40"' || fail "spike users"
echo "$out" | grep -A1 'name: CHECKOUT_RATIO' | grep -q 'value: "0.25"' || fail "checkout ratio"
echo "$out" | grep -A1 'name: TRENDING_RATIO' | grep -q 'value: "0.25"' || fail "trending ratio"
echo "$out" | grep -A1 'name: ORDERS_RATIO' | grep -q 'value: "0.1"' || fail "orders ratio"
echo "$out" | grep -q 'api.js: |' || fail "script configmap"
echo "$out" | grep -q 'mountPath: /dev/shm' || fail "browser mounts /dev/shm"
echo "$out" | grep -q 'medium: Memory' || fail "dshm memory emptyDir"

echo "ALL PASS"
