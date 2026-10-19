# 2. 인프라 구축 (Terraform)

`infra/terraform/envs/demo`가 데모 환경 전체(VPC, EKS, RDS, MSK, OpenSearch, ECR, IAM)를 만듭니다.
사양은 [루트 README의 인프라 구성](../../README.md#인프라-구성-infraterraformenvsdemo)을 참고하세요.

> 💰 **과금 리소스**입니다. 데모 직전에 만들고, 끝나면 바로 [삭제](#2-6-환경-삭제-데모-종료-후-필수)합니다.
> 환경은 1개 공용입니다. 만들기 전에 Slack 데모 채널에서 다른 사람이 쓰고 있지 않은지 확인하세요.

## 2-1. bootstrap (계정당 최초 1회)

Terraform state를 저장할 S3 버킷(`ringdog-tfstate-demo`)과 락 테이블(`ringdog-tfstate-lock`)입니다.
**이미 생성되어 있으므로 팀원은 건너뜁니다.** 무료 수준이라 삭제하지 않고 유지합니다.

새 계정에서만:
```bash
cd infra/terraform/bootstrap
terraform init && terraform apply
```
버킷 이름이 이미 사용 중이라 이름을 바꿨다면 `envs/demo/backend.tf`의 `bucket`도 같이 바꿔야 합니다.

## 2-2. team 스택 (계정당 최초 1회, repo 관리자)

팀원 권한을 관리하는 IAM 그룹 `ringdog-demo-team`과 EKS 관리자 Role `ringdog-demo-eks-admin`을 만듭니다.
비용이 없으므로 **삭제하지 않고 유지**합니다. 팀원은 건너뜁니다.
```bash
cd infra/terraform/team
terraform init && terraform apply
```

apply한 관리자 본인도 `aws iam add-user-to-group --user-name <본인> --group-name ringdog-demo-team`으로 그룹에 넣습니다.

**Datadog AWS 연동 Role (선택, 최초 1회):** Datadog → Integrations → AWS → Add AWS Account → Manually에서
External ID를 받아 `infra/terraform/team/terraform.tfvars`(git에 올라가지 않음)에 `datadog_external_id = "<값>"`으로 적고
team 스택을 다시 apply합니다. 그 다음 Datadog 화면에 계정 ID와 Role 이름 `ringdog-datadog-integration`을 입력합니다.
팀원 추가·제거는 [사전 준비 1-1](./01-prerequisites.md#팀원-추가제거-repo-관리자용)을 참고하세요.

## 2-3. 변수 파일 (최초 1회)

```bash
cd infra/terraform/envs/demo
cp terraform.tfvars.example terraform.tfvars
```
`terraform.tfvars`에서 `github_repo`만 이 repo 경로(`<owner>/ringdog`)로 바꿉니다. 나머지는 기본값을 씁니다.
이 값은 GitHub Actions가 AWS에 OIDC로 로그인할 때 신뢰하는 repo를 지정합니다. (`terraform.tfvars`는 gitignore 대상)

## 2-4. 환경 생성

```bash
cd infra/terraform/envs/demo
terraform init
terraform plan      # 약 69개 리소스 생성 예정이면 정상
terraform apply     # 약 25분 (MSK가 가장 오래 걸림)
```

## 2-5. kubectl 접속

`ringdog-demo-team` 그룹 멤버라면 누가 환경을 만들었든 공용 Role `ringdog-demo-eks-admin`으로 접속할 수 있습니다.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws eks update-kubeconfig --name ringdog-demo --region ap-northeast-2 \
  --role-arn arn:aws:iam::${ACCOUNT_ID}:role/ringdog-demo-eks-admin
kubectl get nodes   # 노드 2대 Ready
```

다음 단계: [3. 서비스 배포](./03-deploy.md)

## 2-6. 환경 삭제 (데모 종료 후 필수)

```bash
# 1) ALB 먼저 정리 — Ingress가 만든 ALB는 Terraform이 관리하지 않아 남으면 VPC 삭제가 막힘
kubectl delete ingress ringdog -n ringdog

# 2) 전체 삭제 (약 15~20분)
cd infra/terraform/envs/demo
terraform destroy
```

삭제 후 확인 (모두 빈 결과여야 정상):
```bash
aws eks list-clusters --region ap-northeast-2
aws rds describe-db-instances --region ap-northeast-2 --query 'DBInstances[].DBInstanceIdentifier'
aws kafka list-clusters-v2 --region ap-northeast-2 --query 'ClusterInfoList[].ClusterName'
aws opensearch list-domain-names --region ap-northeast-2
```

ECR 이미지도 함께 삭제되므로, 다음에 환경을 만들면 이미지 빌드부터 다시 진행됩니다.
마지막으로 Slack 데모 채널에 "환경 삭제 완료"를 공지합니다.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Error acquiring the state lock` | 이전 실행이 비정상 종료되어 락이 남음. **다른 사람이 실행 중이 아닌지 먼저 확인**한 뒤 `terraform force-unlock <LOCK_ID>` |
| `timeout while waiting for plugin to start` | WSL에서 `/mnt/c`·`/mnt/d` 경로로 실행. WSL 내부 경로로 clone해서 실행 |
| `x509: certificate signed by unknown authority` | 사내 TLS 검사. [사전 준비 1-4](./01-prerequisites.md#1-4-사내망tls-검사-환경인-경우) 참고 |
| destroy가 VPC/서브넷에서 멈춤 | Ingress(ALB)를 먼저 지우지 않음. AWS 콘솔에서 `k8s-ringdog-*` ALB와 대상 그룹을 삭제 후 다시 `terraform destroy` |
| `no IAM Role found` (`data.aws_iam_role.team_eks_admin`) | team 스택이 아직 없음. 2-2절 team 스택 apply 후 다시 실행 |
| 실행이 중간에 끊김 | 출력이 없어도 리소스는 생성/삭제되고 있었을 수 있음. 위 "삭제 후 확인" 명령으로 실제 상태 확인 후 다시 실행 |
