#!/usr/bin/env bash
# 시나리오 ① 시연 조작. .github/workflows/demo-control.yml이 실행한다.
# 사용: demo-control.sh <seed|start|spike|inject|mitigate|reset|stop> [widget|session]
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NS="${K8S_NAMESPACE:-ringdog}"

# render_batch_job <fault|safe> <image> → Job YAML (stdout)
# Job 이름: fault → inventory-batch (이름으로 원인이 드러나지 않게), safe → inventory-batch-safe
render_batch_job() {
  local mode="$1" image="$2" delay deadline job_name
  if [ "$mode" = "fault" ]; then
    job_name="inventory-batch"
    delay=180
    deadline=2580
  else
    job_name="inventory-batch-safe"
    delay=0
    deadline=600
  fi
  sed -e "s|__JOB_NAME__|${job_name}|g" \
      -e "s|__MODE__|${mode}|g" \
      -e "s|__IMAGE__|${image}|g" \
      -e "s|__VERSION__|${image##*:}|g" \
      -e "s|__DELAY__|${delay}|g" \
      -e "s|__DEADLINE__|${deadline}|g" \
      "$DEMO_DIR/inventory-batch-job.yaml"
}

# (Task 11에서 나머지 동작과 main 추가)
