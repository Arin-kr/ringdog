# RingDog — Terraform Infrastructure (M1)

Terraform IaC for RingDog, the Datadog observability demo e-commerce app, on
AWS (`ap-northeast-2`). This directory was authored as part of the M1
milestone. **Nothing here has been applied.** No `terraform init`, `plan`,
or `apply` has been run against any AWS account, and no real cloud
resources exist yet — this assistant does not have (and was not given) AWS
credentials. You will need your own AWS account and credentials to actually
provision anything.

## Layout

```
infra/terraform/
├── bootstrap/        # one-time: S3 + DynamoDB for remote state (local state itself)
├── modules/           # reusable building blocks (vpc, eks, rds, msk, opensearch, ecr, iam-irsa, secrets)
└── envs/demo/         # the actual demo environment, wires the modules together
```

## Apply order

This is the order you (with your own AWS credentials configured, e.g. via
`aws configure` or environment variables) would run things in — **not**
something that has already happened:

1. **`bootstrap/`** — run once per AWS account. It has no remote backend of
   its own (local state only — chicken-and-egg: something has to create the
   state bucket/lock table before anything can use them as a backend).

   ```bash
   cd bootstrap
   terraform init
   terraform apply
   terraform output   # note the actual bucket + DynamoDB table names created
   ```

   S3 bucket names are globally unique across *all* AWS accounts, so the
   default (`ringdog-tfstate-demo`) will very likely already be taken by
   someone else. If `apply` fails because of that, set `state_bucket_name`
   to something unique (e.g. suffix your account ID) and re-apply.

2. **Update `envs/demo/backend.tf`** if the bucket/table names bootstrap
   actually created differ from the defaults (`ringdog-tfstate-demo` /
   `ringdog-tfstate-lock`) — Terraform backend blocks can't reference
   variables, so this is a manual sync step.

3. **`envs/demo/`** — the real environment.

   ```bash
   cd envs/demo
   cp terraform.tfvars.example terraform.tfvars   # fill in github_repo at minimum
   terraform init
   terraform plan
   # review the plan, then, only when you're ready to spend money:
   # terraform apply
   ```

## Cost warning

This provisions **real, billable** AWS resources: an EKS cluster + managed
node group (t3.medium x2), a NAT Gateway, an RDS PostgreSQL instance, an MSK
Kafka cluster, and an OpenSearch domain. None of this is free-tier, and all
of it keeps costing money as long as it's running — this is a demo
environment, not a "leave it up" environment. Every module comment in
`modules/*/main.tf` that says "demo cost tradeoff" is a place where a
production-grade setup would cost more (multi-AZ NAT, multi-AZ RDS, bigger
instances, 3 AZs instead of 2, etc.) — those tradeoffs were made
deliberately to keep this cheap to run for a short demo, not because they're
best practice.

**Run `terraform destroy` in `envs/demo/` as soon as you're done with a
demo session.** Bootstrap (`bootstrap/`'s S3 bucket + DynamoDB table) is
cheap enough to leave standing between demos if you plan to redeploy.

## What this assistant did and did not do

- Did: author all `.tf`/`.md` files in this directory as working,
  syntactically valid Terraform HCL, matching the resource/naming choices
  in `PRD_v1.yaml` (region `ap-northeast-2`, cluster `ringdog-demo`, ECR
  repos `ringdog-frontend`/`ringdog-backend-api`/`ringdog-chatbot-service`/
  `ringdog-order-consumer`, namespace `ringdog`).
- Did not, and will not: run `terraform init`, `terraform plan`,
  `terraform apply`, or `terraform destroy`. No AWS credentials are
  available in this environment, and no cloud resources should be touched
  by an assistant acting on your behalf without your explicit review. Applying
  this configuration — and paying for what it creates — is your action to
  take, with your own AWS credentials, after reviewing the plan output.
