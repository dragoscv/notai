# Notai infra — Terraform on GCP (project: notai-prod)

Provisions: Artifact Registry, Cloud Run (web + realtime), Secret Manager,
Cloud Storage (assets + tfstate), IAM, optional custom domain mapping.

Database: Neon (outside Terraform — just paste the pooled URL into `TF_VAR_neon_database_url`).

## Why Terraform (not Pulumi)?
- Mature `hashicorp/google` provider with full Cloud Run v2 coverage.
- Small, rarely-touched stack — HCL is simpler than maintaining a TS Pulumi project.
- No language runtime dependency for `terraform apply`.

## First-time setup

```powershell
# 1) One-time — enable the Resource Manager + Service Usage APIs manually on your project
gcloud config set project notai-prod
gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com
gcloud auth application-default login

# 2) Create a Neon project at https://console.neon.tech and copy the pooled connection string
# 3) Create Google OAuth client (see /docs/setup-google-oauth.md)
# 4) Generate secrets:
$env:TF_VAR_auth_secret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$env:TF_VAR_hocuspocus_jwt_secret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$env:TF_VAR_neon_database_url = "postgres://..."
$env:TF_VAR_google_oauth_client_id = "..."
$env:TF_VAR_google_oauth_client_secret = "..."

# 5) Apply
terraform init
terraform plan
terraform apply
```

## After first apply
Uncomment the `backend "gcs"` block in `versions.tf` and run
`terraform init -migrate-state` to move state into the newly-created bucket.

## CI/CD (future)
GitHub Actions builds Docker images, pushes to Artifact Registry, and updates
the `web_image` / `realtime_image` variables.
