data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name            = "miscellary-prod"
  service_enabled = var.api_image_tag != ""
  web_origin      = "https://${var.domain_name}"
  media_url = var.media_cdn_cutover ? "https://${var.media_domain}" : (
    "https://${var.media_bucket_name}.s3.${var.aws_region}.amazonaws.com"
  )
  alarm_actions  = var.alert_email == "" ? [] : [aws_sns_topic.alerts[0].arn]
  github_parts   = split("/", var.github_repository)
  github_subject = "repo:${local.github_parts[0]}@${var.github_owner_id}/${local.github_parts[1]}@${var.github_repository_id}:environment:Production"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = local.name }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  map_public_ip_on_launch = true

  tags = { Name = "${local.name}-public-${count.index + 1}" }
}

resource "aws_subnet" "database" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)

  tags = { Name = "${local.name}-database-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "load_balancer" {
  name        = "${local.name}-alb"
  description = "Public HTTPS entry point"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-alb" }
}

resource "aws_security_group" "api" {
  name        = "${local.name}-api"
  description = "Fargate API tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-api" }
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "PostgreSQL from the API only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  tags = { Name = "${local.name}-database" }
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.database[*].id
}

resource "aws_db_instance" "main" {
  identifier                   = local.name
  engine                       = "postgres"
  engine_version               = "16"
  instance_class               = var.db_instance_class
  db_name                      = "miscellary"
  username                     = "miscellary"
  manage_master_user_password  = true
  allocated_storage            = 20
  max_allocated_storage        = 100
  storage_type                 = "gp3"
  storage_encrypted            = true
  multi_az                     = false
  publicly_accessible          = false
  availability_zone            = data.aws_availability_zones.available.names[0]
  db_subnet_group_name         = aws_db_subnet_group.main.name
  vpc_security_group_ids       = [aws_security_group.database.id]
  backup_retention_period      = 7
  auto_minor_version_upgrade   = true
  copy_tags_to_snapshot        = true
  deletion_protection          = true
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${local.name}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"
  performance_insights_enabled = false
  apply_immediately            = false

  lifecycle { ignore_changes = [final_snapshot_identifier] }
}

resource "aws_s3_bucket" "media" {
  bucket = var.media_bucket_name
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id

  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = var.media_cdn_cutover
  restrict_public_buckets = var.media_cdn_cutover
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_origins = [local.web_origin]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_headers = ["Content-Type", "Cache-Control"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

data "aws_iam_policy_document" "media" {
  dynamic "statement" {
    for_each = var.media_cdn_cutover ? [1] : []

    content {
      sid       = "CloudFrontReadRenders"
      actions   = ["s3:GetObject"]
      resources = ["${aws_s3_bucket.media.arn}/renders/*"]

      principals {
        type        = "Service"
        identifiers = ["cloudfront.amazonaws.com"]
      }

      condition {
        test     = "StringEquals"
        variable = "AWS:SourceArn"
        values   = [aws_cloudformation_stack.media_cdn[0].outputs["MediaDistributionArn"]]
      }
    }
  }

  dynamic "statement" {
    for_each = var.media_cdn_cutover ? [] : [1]

    content {
      sid       = "PublicReadRenders"
      actions   = ["s3:GetObject"]
      resources = ["${aws_s3_bucket.media.arn}/renders/*"]

      principals {
        type        = "*"
        identifiers = ["*"]
      }

      condition {
        test     = "Bool"
        variable = "aws:SecureTransport"
        values   = ["true"]
      }
    }
  }

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.media.arn, "${aws_s3_bucket.media.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket     = aws_s3_bucket.media.id
  depends_on = [aws_s3_bucket_public_access_block.media]
  policy     = data.aws_iam_policy_document.media.json
}

check "media_cdn_cutover" {
  assert {
    condition     = !var.media_cdn_cutover || var.media_cdn_enabled
    error_message = "media_cdn_enabled must be true before media_cdn_cutover."
  }
}

resource "aws_acm_certificate" "media" {
  domain_name       = var.media_domain
  validation_method = "DNS"

  lifecycle { create_before_destroy = true }
}

resource "aws_acm_certificate_validation" "media" {
  count                   = var.media_cdn_enabled ? 1 : 0
  certificate_arn         = aws_acm_certificate.media.arn
  validation_record_fqdns = [for option in aws_acm_certificate.media.domain_validation_options : option.resource_record_name]
}

resource "aws_cloudformation_stack" "media_cdn" {
  count = var.media_cdn_enabled ? 1 : 0

  name = "${local.name}-media-cdn"
  template_body = jsonencode({
    Resources = {
      MediaOriginAccessControl = {
        Type = "AWS::CloudFront::OriginAccessControl"
        Properties = {
          OriginAccessControlConfig = {
            Name                          = "${local.name}-media"
            OriginAccessControlOriginType = "s3"
            SigningBehavior               = "always"
            SigningProtocol               = "sigv4"
          }
        }
      }
      MediaWebAcl = {
        Type = "AWS::WAFv2::WebACL"
        Properties = {
          Name          = "${local.name}-media"
          Scope         = "CLOUDFRONT"
          DefaultAction = { Allow = {} }
          VisibilityConfig = {
            CloudWatchMetricsEnabled = false
            MetricName               = "${local.name}-media"
            SampledRequestsEnabled   = false
          }
        }
      }
      MediaDistribution = {
        Type = "AWS::CloudFront::Distribution"
        Properties = {
          DistributionConfig = {
            Aliases     = [var.media_domain]
            Comment     = "Miscellary immutable renders"
            Enabled     = true
            HttpVersion = "http2and3"
            IPV6Enabled = true
            Origins = [{
              DomainName            = aws_s3_bucket.media.bucket_regional_domain_name
              Id                    = "media-s3"
              OriginAccessControlId = { Ref = "MediaOriginAccessControl" }
              S3OriginConfig        = { OriginAccessIdentity = "" }
            }]
            DefaultCacheBehavior = {
              AllowedMethods       = ["GET", "HEAD"]
              CachedMethods        = ["GET", "HEAD"]
              CachePolicyId        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
              Compress             = true
              TargetOriginId       = "media-s3"
              ViewerProtocolPolicy = "redirect-to-https"
            }
            PriceClass = "PriceClass_100"
            ViewerCertificate = {
              AcmCertificateArn      = aws_acm_certificate_validation.media[0].certificate_arn
              MinimumProtocolVersion = "TLSv1.2_2021"
              SslSupportMethod       = "sni-only"
            }
            WebACLId = { "Fn::GetAtt" = ["MediaWebAcl", "Arn"] }
          }
        }
      }
      Subscription = {
        Type = "AWS::PricingPlanManager::Subscription"
        Properties = {
          PlanFamily = "CloudFront"
          PlanTier   = "FREE"
          UsageLevel = "DEFAULT"
          ResourceArns = [
            { "Fn::Sub" = "arn:$${AWS::Partition}:cloudfront::$${AWS::AccountId}:distribution/$${MediaDistribution}" },
            { "Fn::GetAtt" = ["MediaWebAcl", "Arn"] }
          ]
        }
      }
    }
    Outputs = {
      MediaDistributionArn = {
        Value = { "Fn::Sub" = "arn:$${AWS::Partition}:cloudfront::$${AWS::AccountId}:distribution/$${MediaDistribution}" }
      }
      MediaDistributionDomain = {
        Value = { "Fn::GetAtt" = ["MediaDistribution", "DomainName"] }
      }
      SubscriptionArn = {
        Value = { Ref = "Subscription" }
      }
    }
  })
}

resource "aws_ecr_repository" "api" {
  name                 = "miscellary-api"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy     = file("${path.module}/../ecr-lifecycle-policy.json")
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "miscellary/app"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "ses" {
  name                    = "miscellary/ses-smtp"
  recovery_window_in_days = 7
}

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_acm_certificate" "api" {
  domain_name       = var.api_domain
  validation_method = "DNS"

  lifecycle { create_before_destroy = true }
}

resource "aws_lb" "api" {
  name               = "miscellary-api"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.load_balancer.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "api" {
  name                 = "miscellary-api"
  port                 = 8000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = "/api/v1/health/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 15
    matcher             = "200"
  }
}

resource "aws_acm_certificate_validation" "api" {
  count                   = local.service_enabled ? 1 : 0
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for option in aws_acm_certificate.api.domain_validation_options : option.resource_record_name]
}

resource "aws_lb_listener" "http" {
  count             = local.service_enabled ? 1 : 0
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = local.service_enabled ? 1 : 0
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.api[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/miscellary-api"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "MiscellaryEcsExecutionRole"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "MiscellaryRuntimeSecrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.app.arn,
        aws_secretsmanager_secret.ses.arn,
        aws_db_instance.main.master_user_secret[0].secret_arn
      ]
    }]
  })
}

resource "aws_iam_role" "task" {
  name               = "MiscellaryApiTaskRole"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy" "task_media" {
  name = "MiscellaryMedia"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.media.arn}/*"
    }]
  })
}

resource "aws_ecs_task_definition" "api" {
  count                    = local.service_enabled ? 1 : 0
  family                   = "miscellary-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
    essential = true
    portMappings = [{
      containerPort = 8000
      hostPort      = 8000
      protocol      = "tcp"
    }]
    environment = [
      { name = "DJANGO_SETTINGS_MODULE", value = "config.settings.prod" },
      { name = "ALLOWED_HOSTS", value = var.api_domain },
      { name = "CORS_ALLOWED_ORIGINS", value = local.web_origin },
      { name = "CSRF_TRUSTED_ORIGINS", value = "${local.web_origin},https://${var.api_domain}" },
      { name = "WEB_URL", value = local.web_origin },
      { name = "EMAIL_FROM", value = "Miscellary <no-reply@${var.domain_name}>" },
      { name = "EMAIL_HOST", value = "email-smtp.${var.aws_region}.amazonaws.com" },
      { name = "EMAIL_PORT", value = "587" },
      { name = "COOKIE_SECURE", value = "true" },
      { name = "COOKIE_SAMESITE", value = "Lax" },
      { name = "DATABASE_SSLMODE", value = "require" },
      { name = "DB_HOST", value = aws_db_instance.main.address },
      { name = "DB_PORT", value = tostring(aws_db_instance.main.port) },
      { name = "DB_NAME", value = aws_db_instance.main.db_name },
      { name = "DB_USER", value = aws_db_instance.main.username },
      { name = "AWS_S3_REGION", value = var.aws_region },
      { name = "AWS_STORAGE_BUCKET_NAME", value = aws_s3_bucket.media.id },
      { name = "MEDIA_PUBLIC_URL", value = local.media_url },
      { name = "WEB_CONCURRENCY", value = "2" },
      { name = "WEB_TIMEOUT", value = "30" }
    ]
    secrets = [
      { name = "SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:secret_key::" },
      { name = "INITIAL_ADMIN_EMAIL", valueFrom = "${aws_secretsmanager_secret.app.arn}:initial_admin_email::" },
      { name = "INITIAL_ADMIN_USERNAME", valueFrom = "${aws_secretsmanager_secret.app.arn}:initial_admin_username::" },
      { name = "INITIAL_ADMIN_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app.arn}:initial_admin_password::" },
      { name = "DB_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
      { name = "EMAIL_HOST_USER", valueFrom = "${aws_secretsmanager_secret.ses.arn}:username::" },
      { name = "EMAIL_HOST_PASSWORD", valueFrom = "${aws_secretsmanager_secret.ses.arn}:password::" }
    ]
    healthCheck = {
      command     = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/')\" || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  count                              = local.service_enabled ? 1 : 0
  name                               = "miscellary-api"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.api[0].arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = false

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.https]

  lifecycle { ignore_changes = [task_definition] }
}

resource "aws_sns_topic" "alerts" {
  count = var.alert_email == "" ? 0 : 1
  name  = "miscellary-production-alerts"
}

resource "aws_sns_topic_subscription" "alerts" {
  count     = var.alert_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "api_cpu" {
  alarm_name          = "miscellary-api-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = local.alarm_actions
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = "miscellary-api"
  }
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "miscellary-database-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2147483648
  alarm_actions       = local.alarm_actions
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "miscellary-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  dimensions          = { LoadBalancer = aws_lb.api.arn_suffix }
}

resource "aws_cloudwatch_metric_alarm" "api_availability" {
  count               = local.service_enabled ? 1 : 0
  alarm_name          = "miscellary-api-no-healthy-target"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_subject]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "MiscellaryGitHubDeployRole"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "MiscellaryApiDeploy"
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = aws_ecr_repository.api.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:RunTask",
          "ecs:UpdateService"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
        Condition = {
          StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" }
        }
      }
    ]
  })
}
