terraform {
  required_version = ">= 1.9.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.14"
    }
  }
  # Uncomment after first `terraform apply` that creates the bucket below,
  # then run `terraform init -migrate-state`.
  # backend "gcs" {
  #   bucket = "notai-prod-tfstate"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
