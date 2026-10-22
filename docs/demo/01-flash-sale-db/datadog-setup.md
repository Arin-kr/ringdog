# 시나리오 ① Datadog UI 설정 가이드

> Datadog 화면에서 직접 설정하는 항목입니다 (최초 1회, repo 관리자). 코드로 만들어지는 부분(Agent·DBM·모니터 JSON)은 다른 문서를 봅니다.
> **public repo 주의:** Connection ID, Slack 채널 ID, org ID, 토큰 값은 이 문서와 커밋에 남기지 않습니다. 아래 `<...>` 자리표시는 본인 환경 값으로 바꿔 쓰고, 값 자체는 저장하지 않습니다.

## 사전 조건

- 팀 권한 스택(`infra/terraform/team`) apply 완료. 이 apply는 **demo-up 전에 사용자가 한 번 수동으로** 합니다. Datadog AWS 연동 Role `ringdog-datadog-integration`이 여기서 만들어집니다.
- Datadog AWS Integration 타일이 권한 부족을 보고하면(예: 특정 서비스 메트릭 누락), 그 Role은 **허용 목록 방식 정책**(ReadOnlyAccess 없음)이므로 `infra/terraform/team/main.tf`에 해당 action을 추가하고 team 스택을 다시 apply합니다.
- `demo-control.yml`, `cd.yml`이 `main`에 있어야 합니다. 모든 데모 워크플로는 main에서 실행됩니다 (OIDC가 `ref:refs/heads/main`만 신뢰).
- DBM용 Postgres 비밀번호는 k8s Secret `datadog-postgres`(네임스페이스 `ringdog`)에 있고, `cd.yml`이 만듭니다. Agent가 `ENC[k8s_secret@ringdog/datadog-postgres/password]`로 읽으므로 Datadog UI에서 따로 입력할 값은 없습니다.

## 1. Slack 연동

경로: Datadog → **Integrations** → **Slack** → Install/Configure

| 순서 | 입력 |
|---|---|
| 1 | **Connect Slack Workspace** → 데모용 Slack 워크스페이스 승인 |
| 2 | Channels 탭 → **Add channel** → `#<데모 채널>` |
| 3 | Slack에서 해당 채널에 Datadog 앱 초대 (`/invite @Datadog`) |

Workflow의 "Make a decision" 버튼을 누르는 사람은 Slack 계정이 Datadog 계정과 연결되어 있어야 합니다 (첫 클릭 때 안내됨).

## 2. GitHub Connection

경로: Datadog → **Actions** → **Workflow Automation** → **Connections** → **New Connection** → **GitHub**

| 항목 | 값 |
|---|---|
| Connection 이름 | `ringdog-github` (Connection ID는 `<CONNECTION_ID>`로만 취급) |
| 인증 방식 | Personal Access Token (fine-grained) |
| Repository access | **`ringdog` 하나만** (Only select repositories) |
| 권한 | Actions: **Read and write**, Contents: **Read** (그 외 없음) |
| 만료 | 데모 기간에 맞춰 짧게 |

토큰 값은 Datadog에 붙여 넣고 끝냅니다. 문서·채팅·커밋에 남기지 않습니다.

## 3. 1차 Workflow `ringdog 인기상품 장애 대응`

완화(위젯 OFF) + 근본 수정(인덱스 적용 + 위젯 ON), 사람 승인 2번.

경로: **Workflow Automation** → **New Workflow**. 이름 `ringdog 인기상품 장애 대응`, 트리거 **Monitor**(모니터 `인기상품 API 지연 지속`).
GitHub 액션은 2절 Connection `<CONNECTION_ID>`를 선택합니다. Slack 액션의 채널은 `#<데모 채널>`입니다.

| # | 액션 | 설정 |
|---|---|---|
| 1 | Slack: Make a decision | 메시지 "`{{ Source.monitor.name }}` — 인기상품 위젯을 끌까요? 코드 버전은 그대로이고 기능 플래그만 끕니다.", 버튼 `위젯 OFF` / `무시`, timeout 10분 |
| 2 | 분기 | `무시` 또는 timeout → Slack "수동 대응 필요" 후 종료 |
| 3 | GitHub: Trigger workflow run | workflow `demo-control.yml`, ref `main`, inputs `{"action":"mitigate","target":"widget"}` |
| 4 | Sleep | 180초 |
| 5 | Datadog: Query metric | RDS CPU `aws.rds.cpuutilization{dbinstanceidentifier:ringdog-demo}`, 인기상품 p95 `<TRENDING_P95_QUERY>` (실환경 Task 17에서 확정) |
| 6 | Slack: Send message | "위젯 OFF 완료. RDS CPU `{{...}}`%, 인기상품 p95 `{{...}}`s. 근본 수정(인덱스) PR을 준비하세요" |
| 7 | Slack: Make a decision | 메시지 "인덱스 PR과 같은 인덱스(`orders_created_at_idx`, `order_items_order_id_idx`)를 적용하고 위젯을 다시 켤까요? PR은 머지하지 않습니다.", 버튼 `인덱스 적용 후 위젯 ON` / `나중에`, timeout 15분 |
| 8 | 분기 | `나중에` 또는 timeout → Slack "위젯 OFF 상태 유지" 후 종료 |
| 9 | GitHub: Trigger workflow run | workflow `demo-control.yml`, ref `main`, inputs `{"action":"fix-index"}` |
| 10 | Sleep | 180초 |
| 11 | Datadog: Query metric | 5단계와 같은 쿼리 |
| 12 | Slack: Send message | "원인 ① 해결: 인덱스 적용 + 위젯 ON. 인기상품 p95 `{{...}}`s, RDS CPU `{{...}}`%" |

`{{...}}`는 5·11단계 Query metric 단계의 출력 변수로, 편집기의 변수 선택기에서 고릅니다.

주의: 7단계의 PR(브랜치 `demo/fix-index-<날짜>`)은 시연 중 MCP가 만드는 것이며 **절대 main에 머지하지 않습니다**. 머지하면 cd.yml이 실행됩니다. DB에는 9단계의 `fix-index`가 같은 인덱스를 직접 만들고, `reset`이 지우고 PR을 닫습니다.

## 4. 2차 Workflow `ringdog 배치 세션 종료`

1차의 1~6단계와 같은 구조입니다. 트리거 모니터는 `DB 블로킹 세션 지속`입니다.

| # | 액션 | 설정 |
|---|---|---|
| 1 | Slack: Make a decision | 메시지 "`{{ Source.monitor.name }}` — 세일가 반영 배치 세션을 끊을까요? 진행 중이던 세일가 반영은 롤백되고, 안전 모드(50개씩 커밋)로 자동 재실행합니다.", 버튼 `블로킹 세션 종료` / `무시`, **timeout 30분** |
| 2 | 분기 | `무시` 또는 timeout → Slack "수동 대응 필요" 후 종료 |
| 3 | GitHub: Trigger workflow run | workflow `demo-control.yml`, ref `main`, inputs `{"action":"mitigate","target":"session"}` |
| 4 | Sleep | 180초 |
| 5 | Datadog: Query metric | checkout p95 `<CHECKOUT_P95_QUERY>`, `ringdog.db.blocking_sessions`, 배치 완료 로그 수 `service:inventory-batch "세일가 반영 완료"` |
| 6 | Slack: Send message | "결제 회복: checkout p95 `{{...}}`s, 블로킹 세션 `{{...}}`, 세일가 반영 완료" |

timeout을 30분으로 두는 이유: 알림이 장애 주입 후 11분 무렵 먼저 도착하고 시연자는 27분 무렵에 처리하므로, 그동안 승인 대기가 만료되면 안 됩니다.

**블로킹 세션 지표와 세션 종료 범위가 다릅니다.**
- Agent 메트릭 `ringdog.db.blocking_sessions`는 "다른 세션을 막고 있고 트랜잭션이 30초 넘게 열려 있는" **모든** 세션을 셉니다 (일부러 넓게 잡음).
- `demo-control mitigate session`은 그중 `application_name`이 `inventory-batch`인 세션만 끊습니다.
- 따라서 배치가 아닌 다른 세션이 막고 있으면 알림은 오지만 종료는 아무것도 끊지 않을 수 있습니다. 이때는 DBM Blocking 트리로 원인을 직접 확인합니다.

배치 Job 이름은 장애 모드 `inventory-batch`, 안전 모드 `inventory-batch-safe`이고, 모드는 라벨 `batch-mode: fault|safe`로 구분합니다. 장애 모드 시작 로그는 "세일가 반영 시작: 대상 1,200개"이며 모드를 암시하는 문구가 없습니다 (관객이 로그에서 배치를 직접 발견하는 장면).

## 5. Workflow 내보내기

각 Workflow 편집 화면 → **Export JSON**. 내려받은 JSON에서 Connection ID, Slack 채널 ID, org ID를 자리표시(`<CONNECTION_ID>`, `<SLACK_CHANNEL_ID>`, `<ORG_ID>`)로 바꾼 뒤 커밋합니다.

| Workflow | 저장 위치 |
|---|---|
| `ringdog 인기상품 장애 대응` | `datadog/workflows/mitigate-widget.json` |
| `ringdog 배치 세션 종료` | `datadog/workflows/mitigate-session.json` |

커밋 전 `grep -nE '[0-9]{12}|xoxb-|ghp_|github_pat_'`로 남은 값이 없는지 확인합니다.

## 6. Bits AI SRE

모니터 알림이 오면 Bits AI SRE가 자동으로 조사하도록 **Composite 모니터 `[RingDog demo] 결제 장애 (Composite)`에만** 켭니다. API·Terraform으로는 켤 수 없어 UI에서 합니다(2026-10-22 공식 문서 확인).

| 방법 | 경로 |
|---|---|
| 모니터 하나 | 모니터 상태 페이지 → **Edit** → **Configure notifications & automations** → **Investigate with Bits AI SRE** 켜기 |
| 목록에서 | **Bits AI SRE → Monitors → Supported** → 해당 모니터의 **Auto-Investigate** 토글 |

- 자동 조사는 **Alert로 바뀔 때만** 시작합니다(Warn·No Data·재알림·테스트 알림은 시작 안 함).
- ⚠️ **모니터마다 24시간에 1번**만 자동 조사합니다(기본 한도). 시연 당일 리허설로 Composite가 한 번 울렸다면 본 시연 때는 자동 조사가 돌지 않으므로, 리허설은 전날 하거나 본 시연에서는 알림 화면의 **Investigate** 버튼으로 수동 시작합니다.
- 다른 모니터(트리거 2개, RUM·APM 개별)에는 켜지 않습니다. 같은 장애로 조사가 여러 번 돌면 결론이 흩어집니다.

## 시연 중 주의

- **시연 중에는 main에 push하지 않기.** cd.yml이 Helm을 기본값으로 다시 배포해 위젯 플래그와 트래픽 설정이 초기화됩니다.
