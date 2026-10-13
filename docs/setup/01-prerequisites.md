# 1. 사전 준비

데모 환경은 **repo 관리자의 AWS 계정 1개를 공용**으로 사용합니다. 팀원은 아래 권한을 받은 뒤 로컬 도구를 설치합니다.

> ⚠️ 이 repo는 **public**입니다. AWS 계정 ID, ARN, 키, 비밀번호를 문서·커밋·이슈에 적지 마세요.
> 자격증명은 로컬 설정(`aws configure`)과 GitHub Secrets에만 둡니다.

## 1-1. 권한 요청 (repo 관리자에게)

| 대상 | 필요한 권한 | 용도 |
|---|---|---|
| GitHub repo | **Write** 권한 초대 | 브랜치 push, 데모 워크플로(Actions) 실행. Read 권한으로는 워크플로를 수동 실행할 수 없음 |
| AWS 계정 | **본인 전용** IAM 사용자 + 액세스 키, IAM 그룹 `ringdog-demo-team` 소속 | Terraform으로 환경 생성·삭제, `kubectl` 접속 (그룹이 두 권한을 모두 부여) |
| Datadog org | org 초대 | 대시보드·APM·RUM·모니터·Workflow·Bits AI 사용 |
| Slack | repo 관리자의 개인 Slack 워크스페이스·데모 채널 초대 | 알람 수신, Workflow 롤백 승인 버튼, 환경 사용 공지 |

> AWS 액세스 키는 사람마다 따로 발급합니다. **키를 공유하지 마세요.** 작업 이력(CloudTrail)이 사람별로 남고, 퇴사 시 그 사람 키만 정리하면 됩니다.

### 팀원 추가·제거 (repo 관리자용)

> ⚠️ IAM 그룹은 구현 항목 C0-2(`infra/terraform/team`)가 반영된 뒤에 존재합니다.

```bash
# 입사: 사용자 생성 → 그룹 추가 → 액세스 키 발급 (키는 메신저 평문이 아닌 안전한 경로로 전달)
aws iam create-user --user-name <이름>
aws iam add-user-to-group --user-name <이름> --group-name ringdog-demo-team
aws iam create-access-key --user-name <이름>

# 퇴사: 액세스 키 삭제 → 그룹 제거 → 사용자 삭제 (즉시 모든 권한 회수, 환경 재생성 불필요)
aws iam list-access-keys --user-name <이름>
aws iam delete-access-key --user-name <이름> --access-key-id <키 ID>
aws iam remove-user-from-group --user-name <이름> --group-name ringdog-demo-team
aws iam delete-user --user-name <이름>
```
퇴사 시 GitHub repo 협업자, Datadog org, Slack 워크스페이스에서도 함께 제거합니다.

## 1-2. 로컬 도구

| 도구 | 버전 | 확인 명령 |
|---|---|---|
| Git | 최신 | `git --version` |
| AWS CLI | v2 | `aws --version` |
| Terraform | 1.7 이상 | `terraform version` |
| kubectl | EKS 1.33과 호환 (1.32~1.34) | `kubectl version --client` |
| Helm | 3.x (선택: 직접 확인용. 배포 자체는 GitHub Actions가 수행) | `helm version` |
| Claude Code + Datadog MCP | 최신 (MCP 시연을 할 경우) | [4. Datadog 설정](./04-datadog.md#4-4-claude-code--datadog-mcp-mcp-시연용) 참고 |

**Windows 사용자**: `aws`/`terraform`/`kubectl`은 WSL(Ubuntu)에서 실행하는 것을 권장합니다.
Terraform은 `/mnt/c`, `/mnt/d` 같은 Windows 경로에서 실행하면 AWS provider 로딩이 매우 느리거나 timeout이 날 수 있으니,
**WSL 내부 경로(예: `~/ringdog`)에 repo를 clone**해서 사용하세요.

## 1-3. AWS 자격증명 설정

```bash
aws configure            # Access Key / Secret Key / region: ap-northeast-2 / output: json
aws sts get-caller-identity   # 본인 IAM 사용자로 나오면 정상
```

## 1-4. 사내망(TLS 검사) 환경인 경우

회사 네트워크가 Zscaler 같은 TLS 검사를 하면 `terraform init`, `aws`, `node` 명령이
`x509: certificate signed by unknown authority` / `unable to get local issuer certificate`로 실패할 수 있습니다.

| 도구 | 해결 |
|---|---|
| Terraform / AWS CLI (WSL·Linux) | 회사 루트 CA를 PEM으로 받아 시스템 CA 번들과 합친 파일을 만들고 `export SSL_CERT_FILE=~/certs/ca-bundle.pem` |
| Node.js (v22 이상) | 명령 앞에 `NODE_OPTIONS=--use-system-ca` |

## 1-5. AWS 계정 최초 1회 설정 (repo 관리자, 이미 완료)

팀원은 건너뛰세요. 새 AWS 계정에서 처음 구축할 때만 필요합니다.
- Terraform state용 S3 버킷 + DynamoDB 락 테이블: [2. 인프라 구축](./02-infra.md#2-1-bootstrap-계정당-최초-1회)의 bootstrap
- 팀 권한 IAM 그룹 + EKS 관리자 Role: [2. 인프라 구축](./02-infra.md#2-2-team-스택-계정당-최초-1회-repo-관리자)의 team 스택
- Amazon Bedrock 콘솔(ap-northeast-2)에서 **Claude 3 Haiku 모델 액세스 활성화** (챗봇용)
- GitHub Secrets 등록: [3. 서비스 배포](./03-deploy.md#3-1-github-secrets-최초-1회-repo-관리자)

다음 단계: [2. 인프라 구축](./02-infra.md)
