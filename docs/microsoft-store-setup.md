# Publishing Notai to the Microsoft Store

This is the step-by-step playbook for getting `Notai_*_x64-setup.exe`
auto-published to the Microsoft Store every time the
`release-desktop` GitHub Actions workflow finishes.

It only needs to be done **once**. After it is set up, every release tag
(`desktop-vX.Y.Z`) will:

1. Build and sign the NSIS installer.
2. Publish it to a GitHub Release.
3. Push the new installer URL to your existing Microsoft Store
   submission and call **Publish**.

> **Estimated time**: 60–90 minutes for first-time setup. Microsoft
> certification of the first manual submission usually takes 24–72
> hours; subsequent automated submissions are typically faster.

---

## 0. Prerequisites

- A working Microsoft account (`name@outlook.com`,
  `name@hotmail.com`, or any account that can sign in to
  <https://partner.microsoft.com>). Use a personal account you control
  — switching the account that owns a Store listing later is painful.
- A credit card (Microsoft will charge a one-time **USD 19** developer
  registration fee for individuals; companies pay USD 99).
- Admin access to the GitHub repository
  (`dragoscv/notai`) so you can add Actions secrets.
- The Tauri release pipeline already producing
  `Notai_<version>_x64-setup.exe` artifacts (this repo already does).

---

## 1. Enrol in the Microsoft Partner Center

1. Open <https://partner.microsoft.com/dashboard/registration> in a new
   tab.
2. Sign in with the Microsoft account you intend to use long-term.
3. Pick **Individual** (cheaper, faster) unless you need a company
   account for invoicing in Romania. You can change later, but it
   resets your Seller ID.
4. Fill in the registration form:
   - **Country/region**: Romania.
   - **Publisher display name**: `Codai` (this is what shows up under
     the app name in the Store; must match the value of
     `bundle.publisher` in `tauri.conf.json`).
   - Address, phone, email — must match a document you can show if
     Microsoft asks for verification.
5. Pay the USD 19 fee. Microsoft sends an email when the account is
   active (usually instant, sometimes a couple of hours).

When you land back in the Partner Center dashboard, you are ready for
step 2.

---

## 2. Reserve the **Notai** name and create the first submission

This first submission has to be done **by hand** — Microsoft requires a
manual review of the very first build. From the second release
onwards, our GitHub Actions job takes over.

1. In Partner Center, go to **Apps and games → Overview** and click
   **+ New product → MSI or EXE app**.
   > ⚠️ **Do not** pick **MSIX/PWA app** — that path is for packaged
   > apps. Tauri produces a classic NSIS installer (`.exe`), so the
   > **MSI/EXE** path is the correct one.
2. Reserve the name `Notai`. If it is taken, pick a variant
   (`Notai – Calm Notes`) and update `productName` in
   `apps/desktop/src-tauri/tauri.conf.json` accordingly.
3. Open the **Properties** page and set:
   - Category: **Productivity**.
   - Subcategory: **Notes**.
   - Privacy policy URL: `https://notai.ro/privacy-policy`.
   - Website: `https://notai.ro`.
   - Support contact: `support@notai.ro`.
4. **Pricing and availability** → **Free**, all markets.
5. **Age ratings** → run the IARC questionnaire (takes 5 minutes).
6. **Packages** → upload the latest
   `Notai_<version>_x64-setup.exe` from the GitHub Release page. The
   Store will scan it; if it complains, fix the warnings and re-upload.
7. **Store listings** → fill in title, short description (max 100 chars),
   long description, search terms, and **at least 1 screenshot**
   (1366×768 minimum). Use the screenshots in
   `apps/desktop/store/screenshots/`.
8. Click **Submit to the Store**.

Wait until Microsoft sends you the **Certification successful** email
(usually 24–72 hours). The app will appear in the Store at
`https://apps.microsoft.com/detail/<your-product-id>`.

> Capture two values from the Partner Center URL bar before moving on:
> - **Product ID** — the long ID after `/products/` in the URL of any
>   submission page. Looks like `9N1234567ABC`.
> - **Seller ID** — go to **Account settings → Account info**; the
>   integer at the top right (e.g. `12345678`) is your Seller ID.

---

## 3. Register an app in Microsoft Entra (formerly Azure AD)

The GitHub Action uses an **Entra application** to authenticate with
the Store API. We need to create the app, give it permission to talk
to the Store, and generate a client secret.

### 3.1 Create the application

1. Open <https://entra.microsoft.com> and sign in with **the same
   Microsoft account** you used for Partner Center.
2. In the left sidebar, click **Identity → Applications → App
   registrations**.
3. Click **+ New registration**.
4. Fill in:
   - **Name**: `Notai Store Publisher`.
   - **Supported account types**: **Accounts in this organisational
     directory only — single tenant**.
   - **Redirect URI**: leave empty.
5. Click **Register**.

You land on the app's **Overview** page. Copy two values from this
page (you will paste them into GitHub secrets later):

- **Application (client) ID** → this becomes `MS_STORE_CLIENT_ID`.
- **Directory (tenant) ID** → this becomes `MS_STORE_TENANT_ID`.

### 3.2 Add the Store API permission

1. In the same app, click **API permissions** in the left rail.
2. Click **+ Add a permission**.
3. Switch to the **APIs my organisation uses** tab and search for
   **Microsoft Store**.
4. Pick **Microsoft Store** → **Application permissions** →
   **`microsoft-store.write`** → **Add permissions**.
5. Click **Grant admin consent for <your-tenant>** and confirm.
   The permission row should turn green with a check.

> If you cannot see **Grant admin consent**, you are not the tenant
> admin. For a personal Entra tenant created when you signed up to
> Partner Center, you ARE the admin — sign out and back in if the
> button is greyed out.

### 3.3 Create a client secret

1. Click **Certificates & secrets** in the left rail.
2. Switch to the **Client secrets** tab.
3. Click **+ New client secret**.
4. Description: `notai-github-actions`. Expiry: **24 months**
   (Microsoft's max — set a calendar reminder for renewal).
5. Click **Add**.
6. Copy the **Value** column **immediately**. This is the only time it
   will be shown. This becomes `MS_STORE_CLIENT_SECRET`.

You should now have **four** values written down somewhere safe:

| GitHub secret             | Where it came from                                     |
| ------------------------- | ------------------------------------------------------ |
| `MS_STORE_TENANT_ID`      | Entra app → Overview → Directory (tenant) ID           |
| `MS_STORE_CLIENT_ID`      | Entra app → Overview → Application (client) ID         |
| `MS_STORE_CLIENT_SECRET`  | Entra app → Certificates & secrets → secret **Value**  |
| `MS_STORE_SELLER_ID`      | Partner Center → Account settings → Account info       |
| `MS_STORE_PRODUCT_ID`     | Partner Center → URL of any submission page (`9N…`)    |

---

## 4. Link the Entra app to your Partner Center account

Even though the Entra app and Partner Center share the same Microsoft
account, you still need to authorise the app inside Partner Center.

1. In Partner Center, click the gear icon (top right) → **Account
   settings**.
2. In the sidebar pick **User management**.
3. Switch to the **Microsoft Entra applications** tab.
4. Click **Add Microsoft Entra applications**, find
   `Notai Store Publisher`, and add it.
5. Assign the **Manager** role to the application. **Manager** is
   required for the Store API to be allowed to publish on your behalf.
6. Save.

---

## 5. Add the secrets to GitHub

In a terminal at the repo root, run:

```pwsh
# Replace each <value> with the real one. Each command pipes through
# stdin so the secret value never lands in shell history.
"<tenant-id>"     | gh secret set MS_STORE_TENANT_ID
"<client-id>"     | gh secret set MS_STORE_CLIENT_ID
"<client-secret>" | gh secret set MS_STORE_CLIENT_SECRET
"<seller-id>"     | gh secret set MS_STORE_SELLER_ID
"<product-id>"    | gh secret set MS_STORE_PRODUCT_ID
```

> ⚠️ **Do not** use `gh secret set <name> --body -`. That uploads the
> literal character `-` instead of reading from stdin. Always pipe and
> omit `--body`.

Verify they are present:

```pwsh
gh secret list | Select-String "MS_STORE"
```

You should see five lines. Until all five are set the
`publish-microsoft-store` job in `release-desktop.yml` is gated off and
silently skips.

---

## 6. Seed the metadata template

The repo ships a placeholder at
`apps/desktop/store/microsoft/metadata.json`. The first time, replace
it with the **real** metadata returned by the Store API for your live
submission:

1. Open <https://github.com/dragoscv/notai/actions> →
   **release-desktop** → **Run workflow**.
2. In the `version` input box, type the literal string
   `__msstore_get_metadata__` and run.
3. The `microsoft-store-get-base-metadata` job downloads your live
   submission's metadata and uploads it as a workflow artifact named
   `microsoft-store-metadata`.
4. Download the artifact, replace `apps/desktop/store/microsoft/metadata.json`
   with its contents, commit, and push.
5. From now on, edit that file (and the screenshots in
   `apps/desktop/store/screenshots/`) like normal source code. The
   `release-store-metadata` workflow pushes any change to the live
   submission automatically.

---

## 7. First automated release

1. Bump the version in `apps/desktop/src-tauri/tauri.conf.json` and
   `apps/desktop/package.json`.
2. Commit and tag:

   ```pwsh
   git commit -am "release(desktop): 0.2.0"
   git tag desktop-v0.2.0
   git push --no-verify
   git push --no-verify origin desktop-v0.2.0
   ```

3. Watch the workflow at
   <https://github.com/dragoscv/notai/actions/workflows/release-desktop.yml>.
   The `publish-microsoft-store` job runs after the GitHub Release is
   published. On success, the Store submission status changes to
   **In progress: certification**.
4. The Store usually re-certifies within a few hours. You will get an
   email when the new build is live.

---

## Troubleshooting

| Symptom                                                           | Fix                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `publish-microsoft-store` shows **skipped** for every release     | One or more `MS_STORE_*` secrets is missing. Re-run step 5 and verify with `gh secret list`.                            |
| `msstore reconfigure` fails with `AADSTS7000215`                  | Wrong client secret value. Generate a new one (step 3.3) and update `MS_STORE_CLIENT_SECRET`.                          |
| `msstore submission update` fails with `403 Forbidden`            | The Entra app does not have the **Manager** role in Partner Center. Re-do step 4.                                       |
| Submission stuck in **Failed certification**                       | Open the Partner Center submission page; the certification report lists the exact reason (often missing privacy URL).   |
| Need to roll back a released version                              | Open the Store submission and click **Halt distribution**. The previous certified build remains the latest install.    |

---

## Maintenance reminders

- **Client secret expiry** — set a calendar reminder ~22 months from
  creation to rotate `MS_STORE_CLIENT_SECRET`.
- **Annual re-certification** — Microsoft asks individual developers
  to confirm tax/identity info once a year. The dashboard shows a
  banner; ignoring it eventually blocks new submissions.
- **Privacy / Terms URLs** — keep `https://notai.ro/privacy-policy`
  and `https://notai.ro/terms` reachable. The Store rejects submissions
  whose declared URLs return 404 or redirect to login walls.
