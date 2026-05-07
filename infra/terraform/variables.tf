variable "project_id" {
  type        = string
  description = "GCP project ID"
  default     = "notai-prod"
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "domain" {
  type        = string
  description = "Primary domain, e.g. notai.app (leave empty to skip domain mapping)"
  default     = ""
}

variable "web_image" {
  type        = string
  description = "Full image ref for the Next.js web app in Artifact Registry"
  default     = "europe-west1-docker.pkg.dev/notai-prod/notai/web:latest"
}

variable "realtime_image" {
  type        = string
  description = "Full image ref for the Hocuspocus server"
  default     = "europe-west1-docker.pkg.dev/notai-prod/notai/realtime:latest"
}

variable "neon_database_url" {
  type        = string
  description = "Pooled connection string from Neon (set via TF_VAR_neon_database_url)"
  sensitive   = true
}

variable "auth_secret" {
  type      = string
  sensitive = true
}

variable "hocuspocus_jwt_secret" {
  type      = string
  sensitive = true
}

variable "google_oauth_client_id" {
  type      = string
  sensitive = true
}

variable "google_oauth_client_secret" {
  type      = string
  sensitive = true
}
