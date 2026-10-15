# 데모 시나리오

환경 준비가 끝났다면([setup](../README.md#시작하기-순서대로)) 시나리오를 골라 진행합니다.
시나리오마다 폴더 하나에 **대본, 체크리스트, 리셋 절차, 진행 현황**을 함께 둡니다.

| # | 시나리오 | 주요 기능 | 상태 |
|---|---|---|---|
| 01 | [배포 후 결제 에러 급증](./01-bad-deploy/README.md) | APM, RUM, Logs, Watchdog, Bits AI SRE, Workflow Automation, MCP | 🔄 구현 준비 중 |
| 02 | 타임세일 트래픽 폭주 → DB 병목 ([설계 초안](../design/specs/2026-10-15-demo-flash-sale-db-design.md)) | Infra, APM, Logs, RUM, DBM, Bits AI SRE/Chat, Workflow Automation, MCP | 📝 설계 초안 (회의 검토) |

## 후보 시나리오 (미착수)

| 후보 | 주요 기능 | 장애 주입 방법 (예정) |
|---|---|---|
| CI/CD Optimization | CI Visibility, Test Optimization, Quality Gates, DORA | flaky 테스트, 느린 빌드 단계 (02 설계 7.1) |
| 주문 처리 지연 | DSM, APM | order-consumer 지연/중지 → consumer lag (02 설계 7.2) |
| 정산 배치 지연 | Jobs Monitoring (Airflow, Spark) | 대량 데이터로 Spark 잡 지연/OOM (02 설계 7.3) |
| 응답은 정상인데 실제로는 장애 | Logs, APM | OpenSearch 연결 차단 → DB fallback |
| 트래픽 급증 / Pod OOM | Infra, APM, Workflow(스케일 아웃) | k6 부하, Chaos Mesh |

## 공통 규칙
- 환경은 1개 공용입니다. **동시에 한 명만** 시연하고, 시작·종료를 Slack 데모 채널에 공지합니다.
- 시연이 끝나면 각 시나리오 문서의 **리셋 절차**를 반드시 수행해서 다음 사람이 같은 상태에서 시작할 수 있게 합니다.
