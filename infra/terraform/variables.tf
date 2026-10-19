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

variable "google_web_client_id" {
  type        = string
  description = "Public Google Web OAuth client ID used as the sign-in token audience. Empty disables Google sign-in."
  default     = ""
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "alerts_url" {
  description = "The Discord alerts relay. Empty turns alerts off; otherwise miscellary/app needs alerts_secret."
  type        = string
  default     = ""
}

variable "lounge_enabled" {
  description = "Opens the Lounge on the API. The web nav also needs NEXT_PUBLIC_LOUNGE_ENABLED on Vercel."
  type        = bool
  default     = false
}

variable "monetization_enabled" {
  description = "Enables ticket spending and membership benefits; does not enable purchases by itself."
  type        = bool
  default     = false
}

variable "stripe_configured" {
  description = "Injects stripe_secret_key and stripe_webhook_secret from miscellary/app."
  type        = bool
  default     = false
}

variable "stripe_checkout_enabled" {
  description = "Allows new website purchases after provider testing and launch approval."
  type        = bool
  default     = false
}

variable "stripe_live_approved" {
  description = "Accepts live Stripe keys and events after release checks pass."
  type        = bool
  default     = false
}

variable "stripe_price_ids" {
  description = "Stripe price IDs keyed by credits_125, credits_275, credits_600, credits_1500 and subscription."
  type        = map(string)
  default     = {}
}

variable "stripe_portal_configuration" {
  description = "Stripe customer portal configuration with cancellation at the paid-period end."
  type        = string
  default     = ""
}
