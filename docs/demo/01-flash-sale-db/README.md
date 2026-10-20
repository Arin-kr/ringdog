# 데모 시나리오 ① 타임세일 트래픽 폭주 → DB 병목

> 탐지(Composite Monitor) → AI 분석(Bits AI SRE·Chat) → 원인 분리(RUM·APM·Log·DBM·Infra) → 승인 기반 완화·수정 적용(Workflow Automation) + 근본 수정안(MCP)
>
> 설계: [`docs/design/specs/2026-10-15-demo-flash-sale-db-design.md`](../../design/specs/2026-10-15-demo-flash-sale-db-design.md)
> 구축 순서: **이 시나리오를 먼저 구축**하면서 데모 공통 기반을 함께 만듭니다. 시나리오 ② [배포 후 결제 에러 급증](../02-bad-deploy/README.md)은 이 환경을 재사용합니다.

## 1. 한 줄 요약

타임세일에 트래픽이 5~10배 늘어난 상태에서 **인덱스 없는 인기상품 집계 쿼리**와 **세일가 반영 배치(`inventory-batch`)의 락**이 겹쳐 결제가 멈춥니다. 사용자 화면에서 시작해 DB 원인 두 개를 분리하고, 원인 ①은 위젯 OFF → MCP 인덱스 PR → 인덱스 적용으로, 원인 ②는 배치 세션 종료 → 안전 모드 재실행으로 하나씩 해결합니다.

| 사용 제품 | Infrastructure · APM · Log · RUM · DBM · Composite Monitor · Workflow Automation · **Bits AI SRE · Bits AI Chat · Datadog MCP** |
|---|---|

## 2. 진행 현황

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 0 | 설계 초안 작성 | ✅ 완료 | 2026-10-15 |
| 1 | 결정 항목 반영, 설계 확정 | ✅ 완료 | 2026-10-16, 설계 8장 |
| 2 | 구현 계획 작성 | ✅ 완료 | `docs/design/plans/2026-10-16-demo-flash-sale-db.md` (Task 1~19) |
| 3 | 오프라인 구현 (계획 Task 1~14) | ✅ 완료 | 2026-10-19 |
| 4 | 실환경 생성·배포·수집 확인 (Task 15) | ✅ 완료 | 2026-10-19~20. `demo-up` 약 35분(리소스 75개) |
| 5 | 장애 재현·튜닝 (Task 16) | 🔄 진행 중 | Step 1~5 완료(원인별 단독 재현, 전체 시연 리허설 1회 성공). 남은 것: Step 6 reset 원복 검증, Step 7 세션 종료 범위, Step 8 소요 시간 문서화 |
| **공통 기반** | | | ②·3단계에서 재사용 |
| B1 | `cd.yml` 수동 실행(`workflow_dispatch`) | ✅ 완료 | `demo-up`이 호출해 배포까지 성공 |
| B2 | 팀 권한 스택 (IAM 그룹 + EKS 관리자 Role + Datadog AWS 연동 Role) | ✅ 완료 | `infra/terraform/team` apply 완료(IAM 3개). Datadog AWS 연동 Role은 계정에 기존 연동이 있어 만들지 않음 |
| B3 | Unified Service Tagging + 에러 로그 보강 | ✅ 완료 | APM `version`=커밋 sha, RUM `env:demo` 확인 |
| B4 | 트래픽 생성기 (k6 API + k6 browser), 평시/급증 프로필 | ✅ 완료 | k6 browser RUM 세션·Replay·프로파일링 수집 확인(2026-10-20). 로그인은 API 호출 + 토큰 주입 |
| B5 | Slack 연동 + GitHub Connection | ⬜ 대기 | 가이드 작성 완료([`datadog-setup.md`](./datadog-setup.md)), UI 설정은 실환경에서 |
| **시나리오 ① 전용** | | | |
| F1 | RDS t3.small + 파라미터 그룹 + DBM 준비 SQL + Agent DBM cluster check | ✅ 완료 | Agent `postgres` 체크 `[OK]`, `ringdog.db.blocking_sessions` 수집 |
| F2 | Datadog AWS Integration (RDS·ALB·MSK) | ✅ 완료 | 계정에 이미 있는 연동 사용 |
| F3 | 인기상품 API·위젯 + checkout 재고 차감 트랜잭션 + 플래그(backend-api 소유) | ✅ 완료 | 장애 중 동작 확인(2026-10-20). checkout이 배치와 같은 순서로 상품을 잠그도록 수정(교착 방지), backend-api 커넥션 풀 Pod당 10. 위젯 표시 규칙: 설계 4.7 |
| F4 | 대량 시드 SQL (cd가 자동 실행, 수동은 `demo-control seed`) | ✅ 완료 | 약 76초, `order_items` 약 150만 행. 재실행 시 건너뜀 |
| F5 | HPA + metrics-server + EKS 노드 3대 고정·전 Pod requests/limits, 세일가 반영 배치 Job `inventory-batch` (장애 모드: 트랜잭션 1개·마지막에 커밋 / 안전 모드: 50개씩 커밋, 진행 로그, 서비스 태그) | ✅ 완료 | HPA 1→4, 장애 배치 약 30분 실행(1,200개 × 1.5초), 안전 모드 약 17초에 1,200/1,200 확인. 설계 4.1.1·4.6 |
| F6 | `demo-control.yml` (inject / mitigate / fix-index / reset + seed / start / spike / stop), `scripts/demo-up.sh`·`demo-down.sh` | 🔄 진행 중 | `demo-up`·`demo-down`·`inject`·`mitigate`(widget·session)·`fix-index`·`reset` 확인. 남은 것: 리허설 뒤 reset 원복(세일가·인덱스·시연 PR) 검증, 세션 종료 범위 검증. 급증 프로필은 위젯 호출 50%·주문 내역 10% |
| F7 | 모니터: Composite(사람 알림), 인기상품 API 지연 지속, DB 블로킹 세션 지속 | ⬜ 대기 | |
| F8 | Workflow 2개: 1차 위젯 OFF → 인덱스 적용 + 위젯 ON (승인 2번) / 2차 블로킹 세션 종료 + 배치 안전 모드 자동 재실행 (승인 1번, 대기 30분) | ⬜ 대기 | 설정 가이드 작성 완료([`datadog-setup.md`](./datadog-setup.md)), 실제 생성은 실환경에서 |
| F9 | 데모 대시보드 | ⬜ 대기 | |
| F10 | MCP 근본 수정 시연 리허설 | ⬜ 대기 | |
| R | 전체 리허설 (타이밍·장애 강도 조정) | ⬜ 대기 | RDS CPU 크레딧 영향 확인 |

상태 표기: ⬜ 대기 / 🔄 진행 중 / ✅ 완료 / ✅ 코드 (코드·문서 작성 완료, 실환경 검증 대기) / ⚠️ 이슈

## 3. 데모 대본 (약 31분)

시연 단계별 상세(사용 제품, 화면, 대처 방법, 트리거 설계, 배치·위젯 동작)는 [설계 3장·4.1.1·4.4~4.7](../../design/specs/2026-10-15-demo-flash-sale-db-design.md#3-시연-진행-약-31분)을 따릅니다.
원인을 **하나씩 끝까지 해결**합니다. 1차에서 위젯 OFF → MCP 인덱스 PR → 인덱스 적용 + 위젯 ON으로 원인 ①을 끝냈는데도 결제가 실패하는 장면이 이 시나리오의 핵심입니다.

### 시연자가 하는 일 5가지

| # | 할 일 | 방법 |
|---|---|---|
| 1 | 환경 올리기 (시연 전날 또는 1시간 전) | WSL에서 `bash scripts/demo-up.sh` — terraform apply → cd(대량 시드·평시 트래픽 포함) → 확인까지 약 30~40분 |
| 2 | 장애 주입 | GitHub Actions **demo-control** → `inject` |
| 3 | 1차 대처 + 원인 ① 근본 수정 | Slack **[위젯 OFF]** → Claude Code로 인덱스 PR → Slack **[인덱스 적용 후 위젯 ON]** |
| 4 | 2차 대처 | Slack **[블로킹 세션 종료]** |
| 5 | 시연 후 | 이어서 쓰면 **demo-control** → `reset` / 끝내면 WSL에서 `bash scripts/demo-down.sh` |

| 시간 | 단계 | 시연자 행동 | 멘트 포인트 |
|---|---|---|---|
| 0:00 | 평시 | 서비스 맵·RUM·데모 대시보드 | "세일 직전, 정상 상태입니다" |
| 3:00 | 장애 주입 | **demo-control** → `inject` (세일가 반영 배치는 3분 뒤 자동 시작) | "20시, 타임세일이 시작됩니다" (배치는 아직 언급하지 않음) |
| 4:00 | 탐지 + AI 1차 조사 | Slack 알림 (Composite) → Bits AI SRE 결과 | "사용자 체감과 서버 양쪽에서 확인될 때만 알립니다. AI가 먼저 방향을 잡아 줍니다" |
| 6:00 | 첫 번째 원인 | DBM Top Query → Explain Plan, Bits Chat Q1 | "인기상품 쿼리가 DB CPU를 다 쓰고 있습니다" |
| 9:00 | 1차 대처 (완화) | Slack "인기상품 API 지연 지속" → **[위젯 OFF]** | "롤백이 아닙니다. 같은 버전 그대로 기능 스위치만 끕니다. DB CPU가 내려갑니다" |
| 11:00 | 원인 ① 근본 수정 | Claude Code + MCP 프롬프트 → 인덱스 마이그레이션 PR (`demo/fix-index-<날짜>`) | "DBM의 Explain Plan을 근거로 AI가 인덱스 수정안을 만듭니다" |
| 14:00 | 수정 적용 | Slack **[인덱스 적용 후 위젯 ON]** | "같은 인덱스를 적용하고 위젯을 다시 켰습니다. Index Scan으로 바뀌었고 DB도 안정적입니다. 이제 해결됐을까요?" |
| 16:00 | 그런데 결제는 여전히 실패 | RUM frustration 세션 → Replay | "인기상품은 빨리 뜨는데, 고객은 아직도 결제 버튼을 누르고 있습니다" |
| 18:00 | 서비스 지연 | checkout 트레이스 + 연결 로그 | "DB에서 계산하는 게 아니라 기다리고 있습니다" |
| 21:00 | 두 번째 원인 (4분) | DBM Blocking 트리 → 블로커 세션(`inventory-batch`, `idle in transaction`) → Kubernetes Explorer의 배치 Job → 배치 로그 → checkout 그래프의 이벤트 오버레이, Bits Chat Q2 | "범인은 세일가를 반영하는 운영 배치였습니다. 커밋을 마지막에 한 번만 해서, 고객이 사려는 상품을 계속 잠그고 있었습니다. 인덱스로는 해결되지 않는 문제입니다" |
| 25:00 | 인프라 확인 | 3:00~9:00 구간 Pod 수·커넥션·RDS CPU·크레딧 | "서버를 늘렸는데 응답 시간은 그대로였습니다. 병목은 DB입니다" |
| 27:00 | 2차 대처 (3분) | Slack "DB 블로킹 세션 지속"(11분 무렵 와서 대기 중) → **[블로킹 세션 종료]** → 배치 안전 모드 자동 재실행 → 배치 로그 "1,200/1,200 완료" | "세션을 끊으면 진행 중이던 세일가 반영은 롤백됩니다. 그래서 50개씩 커밋하는 안전 모드로 바로 다시 돌립니다. 결제도 회복되고 세일가도 반영됐습니다" |
| 30:00 | 정리 | (선택) MCP 포스트모템 초안 | "재발 방지: 인덱스·캐시(①), 배치 시간대 분리·작은 단위 커밋·`lock_timeout`(②)" |

## 4. 데모 전 체크리스트

### 최초 1회 (repo 관리자)
- [ ] [setup 가이드](../../README.md#시작하기-순서대로)의 bootstrap·team 스택·GitHub Secrets·Datadog 설정
- [ ] Datadog 설정: Slack 연동, GitHub Connection, Workflow 2개, 모니터·대시보드 (`datadog-setup.md`)

### 환경 올리기 (환경이 없을 때)
- [ ] WSL에서 `bash scripts/demo-up.sh` → 마지막 줄 `준비 완료: http://<ALB>` (대량 시드·평시 트래픽까지 자동)
- [ ] DBM 수집 확인: Datadog DBM에 RingDog DB 호스트와 쿼리 샘플 표시

### 당일 (30분 전)
- [ ] Slack 데모 채널에 "데모 환경 사용 중" 공지
- [ ] 직전 시연 흔적이 있으면 **demo-control** → `reset` (인덱스 없음, 위젯 OFF, 배치 Job 없음, 시연 PR 닫힘)
- [ ] 평시 트래픽 확인만: APM 요청량, RUM 세션, DBM 쿼리 수신 (demo-up이 켜 둠)
- [ ] 모니터 상태 OK, 열린 알람 없음
- [ ] ⚠️ **시연 중에는 main에 push하지 않기** — cd.yml이 Helm을 기본값으로 다시 배포해 위젯 플래그·트래픽 설정이 초기화됨
- [ ] Datadog 탭(대시보드·RUM·APM·DBM·Infra·Bits AI), Slack, GitHub Actions, Claude Code 미리 열기

## 5. 리셋 절차
1. **demo-control** → `reset` (배치 정리, 세일가 원복, 인덱스 삭제, 위젯 OFF, 시연 PR 자동으로 닫기, 트래픽 평시)
2. 모니터 Resolve 확인, 진행 중 Workflow 실행 취소 확인
3. 환경을 더 쓰지 않으면 WSL에서 `bash scripts/demo-down.sh` (트래픽 끄기 → ALB 정리 → destroy → 삭제 확인)
4. Slack 데모 채널에 "데모 환경 사용 종료" 공지

## 6. 작업 로그
| 날짜 | 내용 |
|---|---|
| 2026-10-15 | 시나리오 설계 초안, 회의용 페이지 작성. 구축 순서를 ① 타임세일 → ② 배포 결함으로 확정, 공통 기반을 ①로 이관 |
| 2026-10-15 | 대처를 1차(위젯 OFF) / 2차(블로킹 세션 종료)로 분리, 원인별 트리거 모니터 2개, 락 주입 3분 지연·최대 30분, "스케일 아웃 함정" 설명 보강 |
| 2026-10-16 | 원인 ② 배치를 "세일가 반영 배치"로 구체화하고 7단계 발견 경로 추가(4분, 전체 약 28분), 위젯 표시 규칙, 10단계를 "원인 ① 근본 수정"으로 변경, "위젯 OFF는 롤백 아님" 멘트 추가 |
| 2026-10-16 | 2차 대처에 배치 안전 모드(50개씩 커밋) 자동 재실행 추가(세션 종료 시 세일가 반영 롤백 보완, 전체 약 29분), reset에 세일가 원복 추가, 설계에 EKS 내부 구조도(Node·Pod·Container) 추가 |
| 2026-10-16 | 설계 8장 1~4번 추천안대로 확정(RDS t3.small, ConfigMap 플래그, GitHub Actions 경유 대처, Jobs Monitoring은 같은 EKS + Spot). metrics-server 설치, 노드 3대 고정(최대 4), 전 Pod 리소스 요청값 추가 |
| 2026-10-16 | 설계 확정. 구축·시연은 1인 진행, 모든 구현 완료 후 팀원에게 공유 예정 |
| 2026-10-16 | 운영 흐름을 시연자 조작 5가지로 묶음(demo-up / inject / 1차+근본 수정 / 2차 / reset·demo-down). 원인 ① 근본 수정(인덱스 적용 + 위젯 ON)을 2차 대처 앞으로 이동(전체 약 31분), 배치 상품당 1.5초(약 30분), cd가 대량 시드·평시 트래픽까지 실행 |
| 2026-10-19 | 오프라인 구현(Task 1~14) 완료. 실환경 첫 생성: MSK 3.8.x로 변경(AWS가 3.6.0 거부), RDS `track_io_timing` 반영 방식 수정, GitHub 기본 브랜치 main으로 변경, k6 setup의 ALB DNS 대기·브라우저 선택자 수정. DBM 수집·대량 시드·reset 2회 확인 |
| 2026-10-20 | k6 browser RUM 0건 원인 수정: RUM 초기화가 화면을 그린 뒤 실행돼 첫 페이지 뷰가 버려지고, 클라이언트 라우팅 전까지 SDK가 시작되지 않음(실사용자도 첫 뷰 유실). 초기화를 렌더 중으로 옮김. `inject` 중 결제 버튼 Rage Click 확인, RUM 브라우저 프로파일링 활성화(`profilingSampleRate` + `Document-Policy: js-profiling`) |
| 2026-10-20 | 장애 강도 튜닝(Task 16 Step 1~3): 급증 때 매 반복 부르던 인기상품·주문 내역이 DB를 100%로 만들어 위젯을 꺼도 CPU가 안 내려감(주문 내역도 인덱스 없이 전체 스캔) → 급증 프로필 위젯 50%·주문 내역 10%. checkout과 배치가 반대 순서로 상품을 잠가 교착(40P01)으로 배치가 13초 만에 죽던 버그 수정. lock 대기 결제가 커넥션 풀을 막아 상품 목록이 느려져 backend-api 풀을 Pod당 10으로 |
| 2026-10-20 | 전체 시연 리허설 1회 성공(Task 16 Step 4~5): 위젯 ON RDS CPU 약 85% → 위젯 OFF 24%, 인덱스 생성 15초(배치 실행 중), 인기상품 7.2초 → 136ms, 그래도 결제 약 98% 실패, 27분에 배치 875/1,200 진행 중, 세션 종료 54초 후 결제 회복·세일가 1,200개 반영. 주의: 인기상품 p95 1.87초로 1차 트리거 기준(2초)에 못 미침 → Task 17에서 기준 1초 검토, `orders`는 새 인덱스가 있어도 Seq Scan(원인 미확인) |
| 2026-10-20 | 인기상품 위젯 UI: 고정 높이(h-56) 때문에 생기던 세로 스크롤 제거(높이는 내용에 맞추고 스켈레톤도 같은 구조), 가로 스크롤바 대신 [<] [>] 버튼으로 넘기기. 코드만 반영, 실서버 확인은 다음 배포 때 |
