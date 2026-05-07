# Deployment Guide

Notai ships three independently-versioned apps. Two of them release through
GitHub Actions when their `package.json` version is bumped on `main`; the web
app ships through Vercel's native git integration on every `main` push.

| App                       | How it deploys                                          | Trigger                                          |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `@notai/web`              | Vercel git integration (auto)                           | every push to `main` (or any preview branch)     |
| `@notai/realtime-server`  | `.github/workflows/release-realtime.yml` → Cloud Run    | bump in `apps/realtime-server/package.json`      |
| `@notai/desktop`          | `.github/workflows/release-desktop.yml` → GitHub Release| bump in `apps/desktop/package.json`              |

Quality gates (lint, typecheck, format, build) run **locally as Husky hooks
before every push**, never on GitHub Actions. CI is reserved for shipping
artifacts.

---

## Cutting a release

```powershell
# 1. Update CHANGELOG.md under [Unreleased] → cut a new section [x.y.z]
code CHANGELOG.md

# 2. Bump the relevant package.json (only for realtime / desktop — web auto-deploys)
pnpm --filter @notai/realtime-server version patch     # or minor / major
# or:  pnpm --filter @notai/desktop version patch

# 3. Commit + push (pre-commit checks the CHANGELOG; pre-push runs lint+typecheck+build)
git add .
git commit -m "chore(realtime): release 0.1.1"
git push
```

The matching workflow runs on merge to `main`, deploys, tags `realtime-vX.Y.Z`
(or `desktop-vX.Y.Z`), and creates a GitHub Release. The web app is updated by
Vercel automatically on every push to `main` — no version bump required.

---

## One-time GitHub setup

### Repository **secrets** (Settings → Secrets and variables → Actions → Secrets)

**Google Cloud — `release-realtime.yml`** (uses Workload Identity Federation,
*no service-account JSON keys*):

- `GCP_WORKLOAD_IDENTITY_PROVIDER` — full provider resource name, e.g.
  `projects/123456789/locations/global/workloadIdentityPools/github/providers/github`
- `GCP_DEPLOY_SERVICE_ACCOUNT` — e.g. `notai-deploy@notai-prod.iam.gserviceaccount.com`

**Tauri — `release-desktop.yml`** (all optional, code-signing hardens releases):

- `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` — for macOS notarization
- `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — for the
  built-in Tauri auto-updater. Generate with `pnpm --filter @notai/desktop tauri signer generate`.

> **Note:** the workflow currently does *not* pass any signing env vars to
> `tauri-action`, so unsigned installers ship by default. To enable signing,
> add the env block back to the `Build + sign Tauri app` step in
> `.github/workflows/release-desktop.yml` only after populating the secrets
> above (an empty `APPLE_CERTIFICATE` causes `security import` to fail).

### Repository **variables** (Settings → Secrets and variables → Actions → Variables)

- `GCP_PROJECT_ID` — e.g. `notai-prod`
- `GCP_REGION` — e.g. `europe-west1`
- `WEB_PUBLIC_URL` — e.g. `https://notai.app` (used when building desktop)
- `HOCUSPOCUS_PUBLIC_URL` — e.g. `wss://realtime.notai.app`

### GitHub **environments** (Settings → Environments)

Create `production-realtime`. Add reviewers if you want manual approval before
each deploy.

---

## One-time GCP setup (Workload Identity Federation)

Run once from a shell with `gcloud auth login`:

```bash
PROJECT_ID=notai-prod
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
GH_REPO=YOUR_GH_USER/notai

# 1. Create the pool + provider
gcloud iam workload-identity-pools create github \
  --project=$PROJECT_ID --location=global --display-name=GitHub

gcloud iam workload-identity-pools providers create-oidc github \
  --project=$PROJECT_ID --location=global \
  --workload-identity-pool=github \
  --display-name=GitHub \
  --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor' \
  --attribute-condition="assertion.repository=='${GH_REPO}'" \
  --issuer-uri='https://token.actions.githubusercontent.com'

# 2. Create the deploy service account
gcloud iam service-accounts create notai-deploy \
  --project=$PROJECT_ID --display-name='Notai GitHub Deployer'

# 3. Grant roles needed for Cloud Run + Artifact Registry
for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/storage.admin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:notai-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role=$ROLE
done

# 4. Allow GitHub Actions to impersonate the SA
gcloud iam service-accounts add-iam-policy-binding \
  notai-deploy@${PROJECT_ID}.iam.gserviceaccount.com \
  --project=$PROJECT_ID \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GH_REPO}"

# Print the values for the GitHub secrets
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github"
echo "GCP_DEPLOY_SERVICE_ACCOUNT=notai-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
```

Then run the Terraform in [`infra/terraform`](../infra/terraform) once to create
Artifact Registry, Secret Manager entries, the Cloud Run services, and the
runtime service account.

---

## One-time Vercel setup

Vercel deploys the web app automatically on every push to `main` — no GitHub
Actions secrets required. Just connect the GitHub repo once:

1. Go to https://vercel.com/new and import `dragoscv/notai`.
2. Set the **Root Directory** to `apps/web`.
3. Vercel auto-detects Next.js. Override the install command if needed:
   `cd ../.. && pnpm install --frozen-lockfile`
   and the build command:
   `cd ../.. && pnpm turbo run build --filter=@notai/web`.
4. Add the production environment variables under Project Settings → Environment Variables:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
   - `HOCUSPOCUS_JWT_SECRET`
   - `NEXT_PUBLIC_HOCUSPOCUS_URL`
   - `NEXT_PUBLIC_APP_URL`

The `apps/web/vercel.json` + `scripts/vercel-should-build.mjs` skip-build script
ensures Vercel only rebuilds when the web app or its shared packages actually
changed — pushes that touch only the realtime server, desktop, infra, or docs
are a no-op.

---

## Local pre-commit hooks

`pnpm install` runs Husky's `prepare` script which installs the hooks under
`.husky/`. They are:

- **`pre-commit`**: runs `lint-staged` (Prettier on staged files) and
  `scripts/check-changelog.mjs` to require a `CHANGELOG.md` entry whenever a
  `package.json` version is bumped.
- **`commit-msg`**: validates Conventional Commits format.
- **`pre-push`**: full `pnpm lint` + `pnpm typecheck` + `pnpm format:check` +
  `pnpm build` (web + realtime). This is the entire CI gate — GitHub Actions
  only ships release artifacts, never re-runs these checks.

Bypass in emergencies with `git commit --no-verify` / `git push --no-verify`,
but please don't make a habit of it.
