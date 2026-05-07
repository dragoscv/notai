############################################################
# Required APIs
############################################################
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "storage.googleapis.com",
    "compute.googleapis.com",
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

############################################################
# Artifact Registry (Docker)
############################################################
resource "google_artifact_registry_repository" "notai" {
  location      = var.region
  repository_id = "notai"
  format        = "DOCKER"
  description   = "Notai container images"
  depends_on    = [google_project_service.apis]
}

############################################################
# Cloud Storage — for drawing/asset uploads
############################################################
resource "google_storage_bucket" "assets" {
  name                        = "${var.project_id}-assets"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  cors {
    origin          = ["https://${var.domain}", "http://localhost:3000"]
    method          = ["GET", "PUT", "POST"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
  depends_on = [google_project_service.apis]
}

############################################################
# Terraform state bucket (uncomment backend in versions.tf after first apply)
############################################################
resource "google_storage_bucket" "tfstate" {
  name                        = "${var.project_id}-tfstate"
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true
  versioning { enabled = true }
  depends_on = [google_project_service.apis]
}

############################################################
# Secrets
############################################################
locals {
  secrets = {
    DATABASE_URL          = var.neon_database_url
    AUTH_SECRET           = var.auth_secret
    HOCUSPOCUS_JWT_SECRET = var.hocuspocus_jwt_secret
    AUTH_GOOGLE_ID        = var.google_oauth_client_id
    AUTH_GOOGLE_SECRET    = var.google_oauth_client_secret
  }
}

resource "google_secret_manager_secret" "this" {
  for_each  = local.secrets
  secret_id = each.key
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "this" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value
}

############################################################
# Service account for Cloud Run
############################################################
resource "google_service_account" "run" {
  account_id   = "notai-run"
  display_name = "Notai Cloud Run"
}

resource "google_project_iam_member" "run_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_project_iam_member" "run_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.run.email}"
}

############################################################
# Cloud Run — web (Next.js)
############################################################
resource "google_cloud_run_v2_service" "web" {
  name     = "notai-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email
    timeout         = "60s"
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = var.web_image
      ports { container_port = 3000 }

      env {
        name  = "NEXT_PUBLIC_APP_URL"
        value = "https://${var.domain != "" ? var.domain : "notai-web-placeholder.run.app"}"
      }
      env {
        name  = "NEXT_PUBLIC_HOCUSPOCUS_URL"
        value = "wss://${replace(google_cloud_run_v2_service.realtime.uri, "https://", "")}"
      }
      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }

      dynamic "env" {
        for_each = toset(["DATABASE_URL", "AUTH_SECRET", "HOCUSPOCUS_JWT_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"])
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this[env.key].secret_id
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
      startup_probe {
        tcp_socket { port = 3000 }
        initial_delay_seconds = 2
        period_seconds        = 3
        failure_threshold     = 10
      }
    }
  }
  depends_on = [google_secret_manager_secret_version.this]
}

############################################################
# Cloud Run — realtime (Hocuspocus, WebSocket)
# Uses session affinity so the WS stays pinned to one instance.
############################################################
resource "google_cloud_run_v2_service" "realtime" {
  name     = "notai-realtime"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email
    # WebSocket timeout — Cloud Run max is 60 min
    timeout                          = "3600s"
    max_instance_request_concurrency = 250
    session_affinity                 = true

    scaling {
      min_instance_count = 1 # keep warm for realtime latency
      max_instance_count = 3
    }

    containers {
      image = var.realtime_image
      ports { container_port = 1234 }

      env {
        name  = "HOCUSPOCUS_PORT"
        value = "1234"
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["DATABASE_URL"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "HOCUSPOCUS_JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["HOCUSPOCUS_JWT_SECRET"].secret_id
            version = "latest"
          }
        }
      }
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
    }
  }
  depends_on = [google_secret_manager_secret_version.this]
}

############################################################
# Public (unauthenticated) access to Cloud Run
############################################################
resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
resource "google_cloud_run_v2_service_iam_member" "realtime_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.realtime.location
  name     = google_cloud_run_v2_service.realtime.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

############################################################
# Custom domain mapping (optional)
############################################################
resource "google_cloud_run_domain_mapping" "web" {
  count    = var.domain == "" ? 0 : 1
  location = var.region
  name     = var.domain
  metadata { namespace = var.project_id }
  spec { route_name = google_cloud_run_v2_service.web.name }
}
