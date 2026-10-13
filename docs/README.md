# RingDog 문서

RingDog repo만으로 **인프라 구축 → 서비스 배포 → Datadog 데모 시연**까지 할 수 있도록 정리한 문서입니다.
처음이라면 아래 순서대로 따라가세요.

## 시작하기 (순서대로)

| 단계 | 문서 | 내용 | 소요 |
|---|---|---|---|
| 1 | [사전 준비](./setup/01-prerequisites.md) | 계정·권한 요청, 로컬 도구 설치 | 최초 1회 |
| 2 | [인프라 구축](./setup/02-infra.md) | Terraform으로 AWS 환경 생성 / 삭제 | 약 25분 |
| 3 | [서비스 배포](./setup/03-deploy.md) | GitHub Actions로 앱 + Datadog Agent 배포 | 약 15분 |
| 4 | [Datadog 설정](./setup/04-datadog.md) | 키, RUM 애플리케이션, Slack, MCP | 최초 1회 |
| 5 | [데모 시나리오](./demo/README.md) | 시나리오별 대본, 체크리스트, 리셋 절차 | 시나리오별 |

> 💰 AWS 환경은 시간 단위로 과금됩니다. 데모가 끝나면 반드시 [환경 삭제](./setup/02-infra.md#2-6-환경-삭제-데모-종료-후-필수)를 하세요.
> 환경은 1개를 공용으로 쓰므로 **동시에 한 명만** 사용합니다. 시작·종료를 Slack 데모 채널에 공지하세요.

## 문서 구조

```
docs/
├── README.md            ← 지금 이 문서 (목차)
├── architecture.md      시스템 아키텍처, CI/CD 흐름, Datadog 제품 매핑
├── setup/               인프라·배포·Datadog 설정 가이드 (01 → 04 순서)
├── demo/                데모 시나리오 (시나리오별 폴더: 대본 + 진행 현황)
├── worklog/             날짜별 작업 기록
└── design/              기능 개발 설계 기록 — specs/(설계서), plans/(구현 계획)
```

## 참고 문서
- 앱 개요·인프라 사양: [루트 README](../README.md)
- Terraform 상세: [`infra/terraform/README.md`](../infra/terraform/README.md)
- Android 앱: [`apps/android-app/README.md`](../apps/android-app/README.md)
