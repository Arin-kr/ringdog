# 데모 시나리오 ① 타임세일 트래픽 폭주 → DB 병목

> 탐지(Composite Monitor) → AI 분석(Bits AI SRE·Chat) → 원인 분리(RUM·APM·Log·DBM·Infra) → 승인 기반 완화(Workflow Automation) → 근본 수정(MCP)
>
> 설계(초안): [`docs/design/specs/2026-10-15-demo-flash-sale-db-design.md`](../../design/specs/2026-10-15-demo-flash-sale-db-design.md)
> 구축 순서: **이 시나리오를 먼저 구축**하면서 데모 공통 기반을 함께 만듭니다. 시나리오 ② [배포 후 결제 에러 급증](../02-bad-deploy/README.md)은 이 환경을 재사용합니다.

## 1. 한 줄 요약

타임세일에 트래픽이 5~10배 늘어난 상태에서 **인덱스 없는 인기상품 집계 쿼리**와 **세일가 반영 배치(`inventory-batch`)의 락**이 겹쳐 결제가 멈춥니다. 사용자 화면에서 시작해 DB 원인 두 개를 분리하고, Slack 승인으로 완화한 뒤 IDE에서 인덱스 마이그레이션 PR까지 만듭니다.

| 사용 제품 | Infrastructure · APM · Log · RUM · DBM · Composite Monitor · Workflow Automation · **Bits AI SRE · Bits AI Chat · Datadog MCP** |
|---|---|

## 2. 진행 현황

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 0 | 설계 초안 작성 | ✅ 완료 | 2026-10-15 |
| 1 | 부서 회의 검토 + 결정 항목 반영 | ⬜ 대기 | 2026-10-16 회의, 설계 8장 |
| 2 | 구현 계획 작성 | ⬜ 대기 | ② 계획의 공통 기반 Task를 흡수 |
| **공통 기반** | | | ②·3단계에서 재사용 |
| B1 | `cd.yml` 수동 실행(`workflow_dispatch`) | ⬜ 대기 | |
| B2 | 팀 권한 스택 (IAM 그룹 + EKS 관리자 Role + Datadog AWS 연동 Role) | ⬜ 대기 | `infra/terraform/team` |
| B3 | Unified Service Tagging + 에러 로그 보강 | ⬜ 대기 | |
| B4 | 트래픽 생성기 (k6 API + k6 browser), 평시/급증 프로필 | ⬜ 대기 | |
| B5 | Slack 연동 + GitHub Connection | ⬜ 대기 | |
| **시나리오 ① 전용** | | | |
| F1 | RDS 파라미터 그룹 + DBM 준비 SQL + Agent DBM cluster check | ⬜ 대기 | |
| F2 | Datadog AWS Integration (RDS·ALB·MSK) | ⬜ 대기 | |
| F3 | 인기상품 API·위젯 + checkout 재고 차감 트랜잭션 + 플래그(backend-api 소유) | ⬜ 대기 | 위젯 표시 규칙: 설계 4.7 |
| F4 | 대량 주문 시드 Job | ⬜ 대기 | |
| F5 | HPA + 세일가 반영 배치 Job `inventory-batch` (트랜잭션 1개·마지막에 커밋, 진행 로그, 서비스 태그) | ⬜ 대기 | 설계 4.6 |
| F6 | `demo-control.yml` (spike / inject / mitigate / reset) | ⬜ 대기 | |
| F7 | 모니터: Composite(사람 알림), 인기상품 API 지연 지속, DB 블로킹 세션 지속 | ⬜ 대기 | |
| F8 | Workflow 2개: 1차 위젯 OFF / 2차 블로킹 세션 종료 (Slack 승인) | ⬜ 대기 | |
| F9 | 데모 대시보드 | ⬜ 대기 | |
| F10 | MCP 근본 수정 시연 리허설 | ⬜ 대기 | |
| R | 전체 리허설 (타이밍·장애 강도 조정) | ⬜ 대기 | RDS CPU 크레딧 영향 확인 |

상태 표기: ⬜ 대기 / 🔄 진행 중 / ✅ 완료 / ⚠️ 이슈

## 3. 데모 대본 (약 28분)

시연 단계별 상세(사용 제품, 화면, 대처 방법, 트리거 설계, 배치·위젯 동작)는 [설계 3장·4.4~4.7](../../design/specs/2026-10-15-demo-flash-sale-db-design.md#3-시연-진행-약-28분)을 따릅니다.
대처는 **1차(위젯 OFF) → 2차(블로킹 세션 종료)** 로 나눕니다. 1차 후에도 결제가 실패하는 장면이 이 시나리오의 핵심입니다.

| 시간 | 단계 | 시연자 행동 | 멘트 포인트 |
|---|---|---|---|
| 0:00 | 평시 | 서비스 맵·RUM·데모 대시보드 | "세일 직전, 정상 상태입니다" |
| 3:00 | 장애 주입 | `demo-control` → `inject` (세일가 반영 배치는 3분 뒤 자동 시작) | "20시, 타임세일이 시작됩니다" (배치는 아직 언급하지 않음) |
| 4:00 | 탐지 + AI 1차 조사 | Slack 알림 (Composite) → Bits AI SRE 결과 | "사용자 체감과 서버 양쪽에서 확인될 때만 알립니다. AI가 먼저 방향을 잡아 줍니다" |
| 6:00 | 첫 번째 원인 | DBM Top Query → Explain Plan, Bits Chat Q1 | "인기상품 쿼리가 DB CPU를 다 쓰고 있습니다" |
| 9:00 | 1차 대처 | Slack "인기상품 API 지연 지속" → **[위젯 OFF]** | "롤백이 아닙니다. 같은 버전 그대로 기능 스위치만 끕니다. DB CPU가 내려갑니다. 이제 해결됐을까요?" |
| 11:00 | 그런데 결제는 여전히 실패 | RUM frustration 세션 → Replay | "고객은 아직도 결제 버튼을 누르고 있습니다" |
| 13:00 | 서비스 지연 | checkout 트레이스 + 연결 로그 | "DB에서 계산하는 게 아니라 기다리고 있습니다" |
| 16:00 | 두 번째 원인 (4분) | DBM Blocking 트리 → 블로커 세션(`inventory-batch`, `idle in transaction`) → Kubernetes Explorer의 배치 Job → 배치 로그 → checkout 그래프의 이벤트 오버레이, Bits Chat Q2 | "범인은 세일가를 반영하는 운영 배치였습니다. 커밋을 마지막에 한 번만 해서, 고객이 사려는 상품을 계속 잠그고 있었습니다. 원인이 두 개였습니다" |
| 20:00 | 인프라 확인 | 3:00~9:00 구간 Pod 수·커넥션·RDS CPU·크레딧 | "서버를 늘렸는데 응답 시간은 그대로입니다. 병목은 DB입니다" |
| 22:00 | 2차 대처 | Slack "DB 블로킹 세션 지속" → **[블로킹 세션 종료]** | "결제가 회복됩니다. 회복 확인까지 자동입니다" |
| 24:00 | 원인 ① 근본 수정 | Claude Code + MCP 프롬프트 | "IDE에서 인덱스 마이그레이션 PR까지 만듭니다. 인덱스는 원인 ①만 해결합니다. 원인 ②는 배치 운영 방식을 바꿔야 합니다" |
| 27:00 | 정리 | (선택) MCP 포스트모템 초안 | "재발 방지: 인덱스·캐시(①), 배치 시간대 분리·작은 단위 커밋·`lock_timeout`(②)" |

## 4. 데모 전 체크리스트

### 환경 준비 (환경이 없을 때)
- [ ] [setup 가이드](../../README.md#시작하기-순서대로) 1~4단계 완료
- [ ] 대량 주문 시드 Job 실행 완료 (환경 재생성마다 1회)
- [ ] DBM 수집 확인: Datadog DBM에 RingDog DB 호스트와 쿼리 샘플 표시

### 당일 (30분 전)
- [ ] Slack 데모 채널에 "데모 환경 사용 중" 공지
- [ ] `demo-control` → `reset` 실행 (인덱스 없음, 위젯 OFF, 배치 Job 없음)
- [ ] 트래픽 생성기 평시 프로필 실행 → APM 요청량, RUM 세션, DBM 쿼리 수신 확인
- [ ] 모니터 상태 OK, 열린 알람 없음
- [ ] Datadog 탭(대시보드·RUM·APM·DBM·Infra·Bits AI), Slack, GitHub Actions, Claude Code 미리 열기

## 5. 리셋 절차
1. `demo-control` → `reset` 실행
2. 모니터 Resolve 확인, 진행 중 Workflow 실행 취소 확인
3. 시연 중 생성된 PR 닫기 + 브랜치 삭제 (인덱스 마이그레이션 PR은 머지하지 않음)
4. 환경을 더 쓰지 않으면 [환경 삭제](../../setup/02-infra.md#2-6-환경-삭제-데모-종료-후-필수)
5. Slack 데모 채널에 "데모 환경 사용 종료" 공지

## 6. 작업 로그
| 날짜 | 내용 |
|---|---|
| 2026-10-15 | 시나리오 설계 초안, 회의용 페이지 작성. 구축 순서를 ① 타임세일 → ② 배포 결함으로 확정, 공통 기반을 ①로 이관 |
| 2026-10-15 | 대처를 1차(위젯 OFF) / 2차(블로킹 세션 종료)로 분리, 원인별 트리거 모니터 2개, 락 주입 3분 지연·최대 30분, "스케일 아웃 함정" 설명 보강 |
| 2026-10-16 | 원인 ② 배치를 "세일가 반영 배치"로 구체화하고 7단계 발견 경로 추가(4분, 전체 약 28분), 위젯 표시 규칙, 10단계를 "원인 ① 근본 수정"으로 변경, "위젯 OFF는 롤백 아님" 멘트 추가 |
