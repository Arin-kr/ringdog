#!/usr/bin/env bash
# deploy/demo 렌더링 테스트. 사용: bash deploy/demo/tests/render-test.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../demo-control.sh
source "$DIR/demo-control.sh"
fail() { echo "FAIL: $*"; exit 1; }

out=$(render_batch_job fault reg.example/ringdog-backend-api:abc123)
echo "$out" | grep -qx '  name: inventory-batch' || fail "fault job name must be exactly inventory-batch"
echo "$out" | grep -q 'backoffLimit: 0' || fail "no retry after session kill"
echo "$out" | grep -q 'activeDeadlineSeconds: 2580' || fail "fault deadline = 180s delay + 40min"
echo "$out" | grep -q 'sleep 180 ' || fail "fault starts 3 min after inject"
echo "$out" | grep -q 'value: "fault"' || fail "BATCH_MODE fault"
echo "$out" | grep -q 'batch-mode: fault' || fail "batch-mode label fault"
echo "$out" | grep -q 'application_name=inventory-batch' || fail "application_name"
echo "$out" | grep -q 'tags.datadoghq.com/version: "abc123"' || fail "UST version from image tag"
echo "$out" | grep -q 'image: reg.example/ringdog-backend-api:abc123' || fail "image"

out=$(render_batch_job safe reg.example/ringdog-backend-api:abc123)
echo "$out" | grep -qx '  name: inventory-batch-safe' || fail "safe job name"
echo "$out" | grep -q 'batch-mode: safe' || fail "batch-mode label safe"
echo "$out" | grep -q 'activeDeadlineSeconds: 600' || fail "safe deadline"
echo "$out" | grep -q 'sleep 0 ' || fail "safe starts immediately"
echo "$out" | grep -q '__' && fail "unreplaced placeholder"

echo "ALL PASS"
