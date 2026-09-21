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
  description = "Globally unique S3 bucket name for uploaded media and renders."
}

variable "media_domain" {
  type    = string
  default = "media.miscellary.com"
}

variable "media_cdn_enabled" {
  type        = bool
  description = "Create the render CDN after its ACM validation record is in DNS."
  default     = false
}

variable "media_cdn_cutover" {
  type        = bool
  description = "Serve render URLs through the verified CDN and make S3 renders private."
  default     = false
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in owner/name form."
}

variable "github_owner_id" {
  type        = string
  description = "Immutable numeric ID of the GitHub repository owner."
}

variable "github_repository_id" {
  type        = string
  description = "Immutable numeric ID of the GitHub repository."
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
