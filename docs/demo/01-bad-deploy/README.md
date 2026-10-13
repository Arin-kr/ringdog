# 데모 시나리오 ① 배포 후 결제 에러 급증

> 탐지(Watchdog) → AI 분석(Bits AI SRE) → 자동 대응(Workflow Automation) → 근본 수정(MCP)
>
> 설계: [`docs/design/specs/2026-10-13-demo-bad-deploy-design.md`](../../design/specs/2026-10-13-demo-bad-deploy-design.md)

## 1. 시나리오 한 줄 요약

backend-api **v1.1.0**("쿠폰 코드 대소문자 무시" 기능 추가)을 배포하자 **쿠폰 없이 주문한 고객만 결제 실패(500)**. Datadog이 자동으로 탐지·분석하고, Slack 승인 한 번으로 롤백, 개발자는 IDE에서 원인 수정 PR까지 완료.

## 2. 진행 현황

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 0 | 설계 문서 작성 | ✅ 완료 | 2026-10-13 |
| 1 | 구현 계획 작성 | ⬜ 대기 | |
| 2 | docs 정리 + setup 가이드(01~04) | ✅ 완료 | 2026-10-13 |
| C0-1 | `cd.yml` 수동 실행(`workflow_dispatch`) | ⬜ 대기 | main 반영 |
| C0-2 | 팀 권한 스택 (IAM 그룹 + EKS 관리자 Role) | ⬜ 대기 | `infra/terraform/team` |
| C1 | Unified Service Tagging(`DD_VERSION`) + 에러 로그 보강 | ⬜ 대기 | main 반영 |
| C2 | 버그 브랜치 `demo/bad-deploy` | ⬜ 대기 | |
| C3 | `demo-build.yml` (버전 이미지 빌드) | ⬜ 대기 | |
| C4 | `demo-deploy.yml` (배포/롤백) | ⬜ 대기 | |
| C5 | 트래픽 생성기 (k6 + Playwright) | ⬜ 대기 | |
| C6-1 | 모니터: checkout 에러율 + Bits AI SRE | ⬜ 대기 | |
| C6-2 | 모니터: Watchdog | ⬜ 대기 | |
| C6-3 | Slack 연동 | ⬜ 대기 | repo 관리자 개인 Free 워크스페이스 채널 |
| C6-4 | Workflow: 승인 기반 롤백 | ⬜ 대기 | GitHub Connection 필요 |
| C6-5 | 데모 대시보드 | ⬜ 대기 | |
| C7 | MCP 근본 수정 시연 리허설 | ⬜ 대기 | |
| R | 전체 리허설 (타이밍 측정) | ⬜ 대기 | |

상태 표기: ⬜ 대기 / 🔄 진행 중 / ✅ 완료 / ⚠️ 이슈

## 3. 데모 대본 (약 15분)

| 시간 | 단계 | 시연자 행동 | 보여줄 화면 | 멘트 포인트 |
|---|---|---|---|---|
| 0:00 | 평상시 | 대시보드 소개 | 데모 대시보드 (v1.0.0 정상) | "지금은 정상 운영 중입니다" |
| 1:00 | 배포 | GitHub에서 `demo-deploy` 실행 `version=1.1.0` | GitHub Actions → APM 서비스 페이지 | "쿠폰 기능 개선 버전을 배포합니다" |
| 3:00 | 장애 발생 | 쇼핑몰에서 쿠폰 입력란을 **비우고** 주문 | 브라우저 에러 화면 | "일부 고객이 결제에 실패합니다" |
| 4:00 | 탐지 | — | Slack 알람, 모니터 (Watchdog Faulty Deployment는 표시된 경우에만) | "배포 직후 이상을 바로 알림으로 받습니다" |
| 6:00 | AI 분석 | Bits AI SRE 조사 결과 열기 | Bits AI SRE 조사 화면 | "AI가 배포-에러-쿠폰 유무 패턴을 근거와 함께 정리합니다" |
| 8:00 | 자동 대응 | Slack에서 **[롤백 승인]** 클릭 | Slack → GitHub Actions → 에러율 그래프 | "사람은 승인만, 롤백과 회복 확인은 자동입니다" |
| 11:00 | 근본 수정 | Claude Code에 프롬프트 입력 | Claude Code → GitHub PR | "개발자는 IDE를 떠나지 않고 원인 수정까지" |
| 14:00 | 영향 확인 | RUM 열기 | Session Replay, Funnel | "고객이 실제로 겪은 화면과 전환율 손실" |

### Bits AI SRE 예시 결론 (실제 결과는 매번 다를 수 있음)
> v1.1.0 배포 직후 `POST /api/orders/checkout`에서 `TypeError: Cannot read properties of undefined (reading 'trim')` 급증. 쿠폰 코드가 없는 요청에서만 발생. v1.0.0으로 롤백 권장.

### MCP 시연 프롬프트
```
Datadog에서 ringdog-backend-api checkout 에러 원인을 찾아서 고쳐줘.
demo/fix-coupon-<날짜> 브랜치에서 테스트도 추가하고, demo/bad-deploy 대상으로 PR 만들어줘.
```

## 4. 데모 전 체크리스트

### 환경 준비 (데모 전, 환경이 없을 때)
- [ ] [setup 가이드](../../README.md#시작하기-순서대로) 1~4단계 완료: 인프라 생성 → 서비스 배포 → Datadog 수집 확인 (환경은 상시 유지하지 않음)
- [ ] `demo-build` 실행: `main → 1.0.0`, `demo/bad-deploy → 1.1.0` (ECR은 destroy 시 삭제되므로 환경 재생성마다 필요)

### 당일 (30분 전)
- [ ] Slack 데모 채널에 "데모 환경 사용 중" 공지 (환경 1개 공용)
- [ ] 트래픽 생성기 실행 → APM 요청량, RUM 세션 수신 확인
- [ ] `demo-deploy version=1.0.0` 실행 (main push로 sha 태그가 되어 있을 수 있음)
- [ ] 모니터 상태 OK, 열린 인시던트/알람 없음
- [ ] Slack 채널, Datadog 탭(대시보드·APM·Bits AI·RUM), GitHub Actions, Claude Code 미리 열기
- [ ] 이전 데모의 fix PR / 브랜치 정리

## 5. 리셋 절차
1. `demo-deploy version=1.0.0` 실행 (롤백이 안 된 경우)
2. 모니터 Resolve 확인
3. 시연 중 생성된 PR 닫기 + `demo/fix-coupon-*` 브랜치 삭제
4. 진행 중 Workflow 실행 취소 확인
5. 환경을 더 쓰지 않으면 [환경 삭제](../../setup/02-infra.md#2-6-환경-삭제-데모-종료-후-필수)
6. Slack 데모 채널에 "데모 환경 사용 종료" 공지

> fix PR은 **절대 머지하지 않습니다.** `demo/bad-deploy`가 항상 버그 상태로 남아 있어야 다음 사람이 같은 데모를 할 수 있습니다.

## 6. 팀원 준비 (최초 1회)

권한(GitHub Write, AWS IAM, Datadog org, Slack 채널)과 도구 설치는 [사전 준비](../../setup/01-prerequisites.md),
MCP 시연 설정은 [Datadog 설정 4-4](../../setup/04-datadog.md#4-4-claude-code--datadog-mcp-mcp-시연용)를 따릅니다.

## 7. 작업 로그
| 날짜 | 내용 |
|---|---|
| 2026-10-13 | 시나리오 설계, 설계 문서·본 문서 작성. docs 정리 및 setup 가이드(01~04) 작성 |
