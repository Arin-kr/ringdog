# Datadog 정의 (시나리오 ①)

Datadog에 만든 모니터·대시보드를 JSON으로 보관합니다. `id`·`creator`·`org_id`·타임스탬프는 지웠고, 환경마다 다른 값은 `<...>` 자리표시로 남겼습니다(public repo — Slack Workspace ID, 채널 ID, org ID는 넣지 않습니다).

| 파일 | Datadog 이름 | 용도 |
|---|---|---|
| `monitors/rum-checkout-slow.json` | `[RingDog demo] RUM 결제 지연` | [결제하기] 클릭 처리 시간 5분 평균 > 1.5초 (사용자 체감) |
| `monitors/apm-checkout-p95.json` | `[RingDog demo] APM checkout p95` | checkout p95 > 3초 (서버) |
| `monitors/composite-checkout.json` | `[RingDog demo] 결제 장애 (Composite)` | 위 두 모니터 AND → Slack 사람 알림 + Bits AI SRE 자동 조사 |
| `monitors/trending-p95.json` | `[RingDog demo] 인기상품 API 지연 지속` | 원인 ① 트리거 (Task 18에서 `@workflow-...` 추가) |
| `monitors/db-blocking-sessions.json` | `[RingDog demo] DB 블로킹 세션 지속` | 원인 ② 트리거 (Task 18에서 `@workflow-...` 추가) |
| `dashboards/demo-flash-sale-db.json` | `[RingDog demo] 01 타임세일 DB 병목` | 시연 대시보드 |

## 다시 만들기

1. Datadog → **Monitors → New Monitor → Import from JSON**에 `monitors/*.json`을 하나씩 붙여 넣습니다. Composite는 마지막에 만들고 `query`의 `<RUM_CHECKOUT_SLOW_ID>`·`<APM_CHECKOUT_P95_ID>`를 앞에서 만든 두 모니터의 ID로, 메시지의 `@slack-<SLACK_ACCOUNT>-<CHANNEL>`을 데모 채널 핸들로 바꿉니다.
2. Datadog → **Dashboards → New Dashboard → 설정(톱니) → Import dashboard JSON**에 `dashboards/demo-flash-sale-db.json`을 붙여 넣습니다.
3. Composite 모니터 편집 화면 → **Configure notifications & automations** → **Investigate with Bits AI SRE**를 켭니다(API·Terraform으로는 못 켬. [`docs/demo/01-flash-sale-db/datadog-setup.md`](../docs/demo/01-flash-sale-db/datadog-setup.md) 6절).

Claude Code + Datadog MCP로 만들면 모니터가 **draft**로 생기므로, 알림을 받으려면 UI에서 publish하거나 `draft_status: published`로 바꿔야 합니다.
