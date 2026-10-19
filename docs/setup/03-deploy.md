# 3. 서비스 배포 (GitHub Actions)

`.github/workflows/cd.yml`이 서비스 4개(frontend, backend-api, chatbot-service, order-consumer)와
Datadog Agent를 EKS에 배포합니다. AWS 키 없이 OIDC로 로그인하며,
DB 접속 정보·Kafka 주소·OpenSearch 주소 등 환경마다 바뀌는 값은 **배포할 때마다 AWS에서 자동 조회**합니다.

## 3-1. GitHub Secrets (최초 1회, repo 관리자)

**이미 등록되어 있으므로 팀원은 건너뜁니다.** repo → Settings → Secrets and variables → Actions

| Secret | 값 출처 |
|---|---|
| `AWS_ROLE_ARN` | `terraform output github_actions_role_arn` — Role 이름이 고정이라 환경을 다시 만들어도 값이 같음 |
| `DD_API_KEY` | Datadog → Organization Settings → API Keys |
| `DD_APP_KEY` | Datadog → Organization Settings → Application Keys |
| `DD_RUM_APPLICATION_ID` | Datadog → Digital Experience → Manage Applications에서 만든 **브라우저** RUM 애플리케이션 ([4. Datadog 설정](./04-datadog.md#4-2-rum-애플리케이션-최초-1회-repo-관리자)) |
| `DD_RUM_CLIENT_TOKEN` | 같은 RUM 애플리케이션의 Client Token |

## 3-2. 배포 실행

GitHub → Actions → **cd** → **Run workflow** (브랜치: `main`) 를 누릅니다.
main에 push해도 자동으로 실행됩니다.

GitHub → Actions → `cd`에서 진행 상황을 확인합니다. 약 15분 걸리며 아래 순서로 실행됩니다.
1. 이미지 4개 빌드 → ECR push
2. Datadog Agent 설치 (`DD_API_KEY`가 있을 때)
3. DB 마이그레이션 + 시드 (상품 60개)
4. AWS Load Balancer Controller 설치 → 앱 Helm 배포 → ALB 생성
5. Datadog 배포 이벤트 전송 → 스모크 테스트

## 3-3. 배포 확인

```bash
kubectl get pods -n ringdog          # 앱 4개 + datadog-agent 모두 Running
kubectl get ingress ringdog -n ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

출력된 ALB 주소로 접속합니다. (ALB DNS가 퍼지는 데 2~3분 걸릴 수 있음)
- `http://<ALB 주소>/` — 쇼핑몰 화면
- `http://<ALB 주소>/api/products?limit=1` — 상품 API 응답

간단한 동작 확인: 회원가입 → 로그인 → 상품을 장바구니에 담기 → 주문 → 주문 내역에서 상태가 `PENDING` → `PAID`로 바뀌면 정상입니다.
(회원가입 응답에는 토큰이 없으므로 가입 후 로그인을 해야 합니다)

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Configure AWS credentials` 단계 실패 | 환경이 없거나(`terraform apply` 전) `AWS_ROLE_ARN`이 잘못됨. OIDC는 `main` 브랜치와 PR에서만 허용됨 |
| `x509: certificate signed by unknown authority` (Ingress 적용 중) | ALB Controller 시작 직후 일시적 오류. 워크플로가 자동으로 최대 5회 재시도 |
| ALB 주소로 접속 불가 | DNS 전파 대기 (2~3분). `kubectl get ingress -n ringdog`에 ADDRESS가 있는지 확인 |
| GitHub에서 Re-run 불가 | 30일이 지난 실행은 re-run이 안 됨. Run workflow로 새로 실행 |

다음 단계: [4. Datadog 설정](./04-datadog.md)
