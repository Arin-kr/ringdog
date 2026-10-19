# envs/demo와 같은 bootstrap 버킷/락 테이블, key만 다름.
# 이 스택은 비용이 없으므로 destroy하지 않고 계속 유지한다.
terraform {
  backend "s3" {
    bucket         = "ringdog-tfstate-demo"
    key            = "team/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "ringdog-tfstate-lock"
    encrypt        = true
  }
}
