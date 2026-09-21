output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "api_load_balancer_dns" {
  value = aws_lb.api.dns_name
}

output "api_certificate_validation" {
  value = {
    for option in aws_acm_certificate.api.domain_validation_options : option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
}

output "media_certificate_validation" {
  value = {
    for option in aws_acm_certificate.media.domain_validation_options : option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
}

output "media_cloudfront_domain" {
  value = var.media_cdn_enabled ? aws_cloudformation_stack.media_cdn[0].outputs["MediaDistributionDomain"] : null
}

output "ses_verification_record" {
  value = {
    name  = "_amazonses.${var.domain_name}"
    type  = "TXT"
    value = aws_ses_domain_identity.main.verification_token
  }
}

output "ses_dkim_records" {
  value = [
    for token in aws_ses_domain_dkim.main.dkim_tokens : {
      name  = "${token}._domainkey.${var.domain_name}"
      type  = "CNAME"
      value = "${token}.dkim.amazonses.com"
    }
  ]
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "ses_secret_arn" {
  value = aws_secretsmanager_secret.ses.arn
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
