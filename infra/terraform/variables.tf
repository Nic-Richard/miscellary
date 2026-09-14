variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" {
  type    = string
  default = "miscellary.com"
}

variable "api_domain" {
  type    = string
  default = "api.miscellary.com"
}

variable "media_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for public media."
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in owner/name form."
}

variable "alert_email" {
  type        = string
  description = "Address for infrastructure alarms. Leave empty to create alarms without notifications."
  default     = ""
}

variable "api_image_tag" {
  type        = string
  description = "Existing ECR image tag. Leave empty during the foundation apply."
  default     = ""
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}
