output "web_url" {
  value       = google_cloud_run_v2_service.web.uri
  description = "URL of the deployed Next.js web app"
}

output "realtime_url" {
  value       = google_cloud_run_v2_service.realtime.uri
  description = "URL of the Hocuspocus realtime server (use wss://<host>)"
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.notai.repository_id}"
}

output "assets_bucket" {
  value = google_storage_bucket.assets.name
}

output "tfstate_bucket" {
  value = google_storage_bucket.tfstate.name
}
