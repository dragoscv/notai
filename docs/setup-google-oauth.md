# Setting up Google OAuth for Notai

Notai uses Google as the sign-in provider via Auth.js v5.
You'll create an OAuth 2.0 **Client ID** inside your existing `notai-prod` GCP project.

## Steps (≈ 5 minutes)

1. Go to https://console.cloud.google.com and confirm you're in the **notai-prod** project (top-left selector).

2. Visit **APIs & Services → OAuth consent screen** → Get started
   - User type: **External** (required for Google personal accounts)
   - App name: `Notai`
   - User support email: your email
   - Developer contact email: your email
   - You can keep it in **Testing** mode indefinitely — just add your Google account as a test user. No verification needed while Testing.

3. Visit **APIs & Services → Credentials** → **Create credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Notai Web`
   - **Authorized JavaScript origins**:
     - `http://localhost:15600`
     - `https://your-domain.tld` *(add later when you deploy)*
   - **Authorized redirect URIs**:
     - `http://localhost:15600/api/auth/callback/google`
     - `https://your-domain.tld/api/auth/callback/google` *(add later)*
   - Click **Create**

4. Copy the **Client ID** and **Client secret** shown in the modal.

5. Paste them into `.env.local`:

   ```env
   AUTH_GOOGLE_ID=xxxx.apps.googleusercontent.com
   AUTH_GOOGLE_SECRET=GOCSPX-xxxxxxxxxxxx
   ```

6. Restart the dev server.

## When you deploy

Add your production redirect URI to the **same** OAuth client:
`https://<your-domain>/api/auth/callback/google`. No need to create a new client.

## Security notes

- The `AUTH_GOOGLE_SECRET` is stored in Secret Manager in production (via Terraform).
- `allowDangerousEmailAccountLinking: true` is on in `apps/web/src/auth.ts` — this lets the same Google email sign in even if you later add another provider. Safe because Google verifies the email.
