# RingDog

Datadog 풀스택 관측성(RUM, APM, Logs, CI/CD Visibility, DSM, LLM Observability, ASM, Infrastructure Monitoring)
데모용 키링 이커머스 애플리케이션. 전체 요구사항은 [`PRD_v1.yaml`](./PRD_v1.yaml) 참고.

## 모노레포 구조

```
apps/
  frontend/           Next.js (App Router) 사용자 웹
  backend-api/        Express - 인증/상품/검색/장바구니/주문 API
  chatbot-service/    Express - Amazon Bedrock 기반 챗봇
  order-consumer/     Node - MSK(Kafka) OrderPlaced 컨슈머
packages/
  shared/             서비스 간 공유 TS 타입 및 이벤트 스키마
  db/                 Prisma 스키마 및 생성된 DB 클라이언트 (단일 소스)
infra/terraform/
  bootstrap/          Terraform 원격 state용 S3 + DynamoDB (최초 1회 수동 적용)
  modules/            vpc / eks / rds / msk / opensearch / ecr / iam-irsa / secrets
  envs/demo/          위 모듈을 조합하는 데모 환경 루트 스택
deploy/helm/          Datadog Agent Helm values, 서비스별 배포 매니페스트
.github/workflows/    GitHub Actions CI/CD (lint/test/terraform plan, build/push/deploy)
docs/                 아키텍처 및 데모 시나리오 문서
```

## 로컬 개발 준비

```bash
corepack enable
pnpm install
cp .env.example .env   # 각 서비스 .env 도 필요 시 개별 작성

docker compose up -d          # postgres / kafka / opensearch 로컬 기동
pnpm --filter @ringdog/db run generate
pnpm --filter @ringdog/db run migrate
pnpm --filter @ringdog/db run build     # dist 빌드 (다른 서비스가 컴파일된 클라이언트를 require 함)
pnpm --filter @ringdog/db run seed      # 샘플 키링 상품 60개 시드 (선택)

pnpm dev                      # 전체 앱 동시 기동 (frontend:3000, backend-api:4000, chatbot-service:4001)
```

## 배포 (AWS)

1. `infra/terraform/bootstrap` 를 1회 적용하여 Terraform state용 S3 버킷/DynamoDB 테이블 생성.
2. `infra/terraform/envs/demo` 에서 VPC/EKS/RDS/MSK/OpenSearch/ECR/IAM(IRSA)/Secrets Manager 구성.
3. `deploy/helm/datadog-agent` 로 Datadog Agent Helm 배포.
4. GitHub Actions(`.github/workflows/cd.yml`)가 main 브랜치 머지 시 ECR 푸시 및 EKS 배포 수행.

세부 아키텍처는 [`docs/architecture.md`](./docs/architecture.md) 참고.

## 개발 단계 (PRD `delivery_plan` 기준)

- **M1**: AWS 인프라/IaC + CI/CD + Helm 차트 기반 구성 (완료)
- **M2**: 코어 이커머스 기능(인증/상품/검색/장바구니/주문/주문취소/상품상세) + 프론트 UI (완료)
- **M3**: 챗봇 Bedrock 실연동 및 LLM Observability (기능 완료, 응답 품질 점검 필요)
- **M4**: 관측성/보안/CI-CD 시연 고도화 (부분 완료 — ASM 앱 배선 및 대시보드 육안 확인 남음)

상세 현황은 [`docs/architecture.md`](./docs/architecture.md#4-현재-구현-상태-2026-07-10-기준)와
[`docs/local-setup-progress.md`](./docs/local-setup-progress.md) 참고.
