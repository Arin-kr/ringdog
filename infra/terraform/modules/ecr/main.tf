# RingDog ECR module
#
# One repository per app: ringdog-frontend, ringdog-backend-api,
# ringdog-chatbot-service, ringdog-order-consumer. Image scanning on push is
# enabled (free basic scanning) per the PRD's security principles.

resource "aws_ecr_repository" "this" {
  for_each = toset(var.repository_names)

  name                 = each.value
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(var.tags, {
    Name = each.value
  })
}

resource "aws_ecr_lifecycle_policy" "expire_untagged" {
  for_each = aws_ecr_repository.this

  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged images after ${var.untagged_image_expiry_days} days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = var.untagged_image_expiry_days
      }
      action = {
        type = "expire"
      }
    }]
  })
}
