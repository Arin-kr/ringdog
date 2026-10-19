# 4. Datadog 설정

Datadog Agent는 [3. 서비스 배포](./03-deploy.md)에서 자동으로 설치됩니다.
여기서는 최초 1회 설정과 배포 후 데이터 수집 확인 방법을 다룹니다.

## 4-1. 계정과 키

- 팀원: repo 관리자에게 Datadog org 초대를 받습니다.
- API Key / Application Key: repo 관리자가 GitHub Secrets에 등록해 두었습니다 ([3-1](./03-deploy.md#3-1-github-secrets-최초-1회-repo-관리자)). 팀원이 따로 만들 필요는 없습니다.

## 4-2. RUM 애플리케이션 (최초 1회, repo 관리자)

**이미 생성되어 있으므로 팀원은 건너뜁니다.**
Digital Experience → Manage Applications → New Application → **JS (브라우저)** 타입으로 만들고,
Application ID와 Client Token을 GitHub Secrets(`DD_RUM_APPLICATION_ID`, `DD_RUM_CLIENT_TOKEN`)에 등록합니다.
프론트엔드 코드의 RUM 설정은 `apps/frontend/src/lib/datadogRum.ts`에 있습니다 (Session Replay 100%, 백엔드 트레이스 연결 포함).

## 4-3. Slack 연동 (최초 1회)

데모 알람과 Workflow 롤백 승인 버튼은 **repo 관리자의 개인 Slack 워크스페이스(Free 플랜) 채널**을 사용합니다.

| 담당 | 할 일 |
|---|---|
| repo 관리자 | Datadog → Integrations → **Slack** 설치, 데모 채널을 Datadog에 연결 (최초 1회) |
| repo 관리자 | 팀원을 Slack 워크스페이스와 데모 채널에 초대 |
| 팀원 | 초대 수락. 롤백 승인 버튼을 누르려면 Slack 계정이 Datadog 계정과 연결되어 있어야 할 수 있음 (첫 클릭 시 안내에 따라 연결) |

데모 채널은 알람 수신 외에 **환경 사용 시작/종료 공지** 용도로도 씁니다.

## 4-4. Claude Code + Datadog MCP (MCP 시연용)

데모의 "IDE에서 원인 분석·수정" 장면을 시연하려면 시연자 PC에 설정합니다.
1. Claude Code 설치
2. Datadog MCP Server 연결: [공식 설정 문서](https://docs.datadoghq.com/bits_ai/mcp_server/setup/) 참고, 데모 org로 로그인
3. 이 repo를 clone한 폴더에서 Claude Code를 실행하고 "Datadog에서 ringdog-backend-api 서비스 상태 알려줘"로 연결 확인

## 4-5. 배포 후 수집 확인

| 확인 위치 | 정상 상태 |
|---|---|
| Infrastructure → Kubernetes | 클러스터 `ringdog-demo`, 노드 3대, `ringdog` 네임스페이스 Pod |
| APM → Service Catalog | `ringdog-backend-api`, `ringdog-chatbot-service`, `ringdog-order-consumer` (env: `demo`) |
| Logs | `service:ringdog-backend-api` 로그, 로그에서 트레이스로 이동 가능 |
| Digital Experience → RUM | 쇼핑몰 접속 후 세션과 Session Replay 표시 |
| Data Streams Monitoring | `backend-api` → `ringdog.orders` → `order-consumer` 흐름 (주문 1건 이상 후) |
| Database Monitoring → Databases | `ringdog-demo` 표시, Query Metrics에 쿼리 목록 (시나리오 ①, Agent의 Postgres 체크) |
| Infrastructure (Metrics/Kubernetes) | `kube_deployment:backend-api`의 HPA 지표 (시나리오 ①) |
| Metrics → Explorer (AWS 연동) | `aws.rds.cpuutilization` 수신 (Datadog AWS Integration 설정 후) |

데이터가 없으면 `kubectl get pods -n ringdog`에서 `datadog-agent` Pod가 Running인지,
GitHub Actions 로그에서 "Deploy / upgrade Datadog Agent" 단계가 실행되었는지(`DD_API_KEY` 등록 여부) 확인합니다.

## 4-6. 데모용 설정

모니터, Workflow Automation, 대시보드 같은 시나리오별 설정은 각 시나리오 문서에 정리합니다.
→ [데모 시나리오 목록](../demo/README.md)

시나리오 ① 설정(Slack 연동, GitHub Connection, Workflow 2개, Bits AI SRE)은 [`docs/demo/01-flash-sale-db/datadog-setup.md`](../demo/01-flash-sale-db/datadog-setup.md)를 따릅니다.

다음 단계: [5. 데모 시나리오](../demo/README.md)
