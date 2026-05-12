import Link from 'next/link';
import type { Metadata } from 'next';
import { resolveLocale } from '../../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'API pentru dezvoltatori Notai' : 'Notai Developer API',
    description: isRo
      ? 'API REST public pentru a crea, citi și actualiza notițe programatic, cu token-uri bearer.'
      : 'Public REST API for creating, reading, and updating notes programmatically with bearer tokens.',
  };
}

const BASE = 'https://notai.app/api/v1';

function EnBody() {
  return (
    <>
      <h1>Notai Developer API</h1>
      <p>
        A small REST surface so you can wire Notai into Zapier, n8n, your own scripts, or any place
        that can send an HTTP request. Authentication is by API key, generated in{' '}
        <Link href="/app/settings/api-keys">Settings &rarr; API keys</Link>.
      </p>
      <p>
        <Link href="/developers/api/reference">
          <strong>Open the interactive API reference &rarr;</strong>
        </Link>{' '}
        \u00b7 Machine-readable spec at{' '}
        <Link href="/api/v1/openapi">
          <code>/api/v1/openapi</code>
        </Link>{' '}
        (OpenAPI 3.1 JSON).
      </p>

      <h2>Authentication</h2>
      <pre>
        <code>Authorization: Bearer nk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
      </pre>
      <p>
        Keys are checked per-request and scoped. Default scopes are{' '}
        <code>notes:read notes:write</code>; tokens shown only once at creation. Revoke any time
        \u2014 calls return <code>401</code> immediately afterward.
      </p>

      <h2>Endpoints</h2>

      <h3>List notes</h3>
      <pre>
        <code>{`GET ${BASE}/notes
Authorization: Bearer nk_...`}</code>
      </pre>
      <p>Returns up to 50 most recently updated notes for the key holder.</p>
      <pre>
        <code>{`{
  "notes": [
    { "id": "abc", "title": "Hello", "icon": "\ud83d\udcdd", "kind": "note",
      "updatedAt": "2026-01-...", "createdAt": "2025-12-..." }
  ]
}`}</code>
      </pre>

      <h3>Create a note</h3>
      <pre>
        <code>{`POST ${BASE}/notes
Authorization: Bearer nk_...
Content-Type: application/json

{
  "title": "From Zapier",
  "plaintext": "Body content...",
  "icon": "\ud83d\udcc5",
  "folderId": null
}`}</code>
      </pre>
      <p>
        All fields are optional. <code>plaintext</code> caps at 200,000 characters,{' '}
        <code>title</code> at 200. Returns <code>201</code> with <code>{`{ id, title }`}</code>.
      </p>

      <h3>Get a note</h3>
      <pre>
        <code>{`GET ${BASE}/notes/{id}`}</code>
      </pre>

      <h3>Update a note</h3>
      <pre>
        <code>{`PATCH ${BASE}/notes/{id}
Content-Type: application/json

{ "title": "New title", "plaintext": "Replaced body" }`}</code>
      </pre>

      <h3>Delete (archive) a note</h3>
      <pre>
        <code>{`DELETE ${BASE}/notes/{id}`}</code>
      </pre>
      <p>
        Soft-deletes the note (moves it to trash). It can be restored from the trash UI for the
        configured retention window.
      </p>

      <h2>Errors</h2>
      <ul>
        <li>
          <code>401 unauthorized</code> \u2014 missing or invalid bearer
        </li>
        <li>
          <code>403 missing scope X</code> \u2014 token lacks the required scope
        </li>
        <li>
          <code>400 invalid json</code> / validation \u2014 fix the payload
        </li>
        <li>
          <code>404 not found</code> \u2014 the note isn\u2019t owned by the key holder
        </li>
      </ul>

      <h2>Limits</h2>
      <p>
        The API piggybacks on each user\u2019s plan-level AI / storage quota. Pro plans get higher
        write throughput. Hard 200 KB body cap.
      </p>

      <h2>Curl example</h2>
      <pre>
        <code>{`curl -H "Authorization: Bearer $NOTAI_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"title":"Test","plaintext":"hello"}' \\
     ${BASE}/notes`}</code>
      </pre>
    </>
  );
}

function RoBody() {
  return (
    <>
      <h1>API pentru dezvoltatori Notai</h1>
      <p>
        O suprafață REST mică prin care poți conecta Notai la Zapier, n8n, propriile tale scripturi
        sau orice loc care poate trimite o cerere HTTP. Autentificarea se face prin cheie API,
        generată din <Link href="/app/settings/api-keys">Setări &rarr; Chei API</Link>.
      </p>
      <p>
        <Link href="/developers/api/reference">
          <strong>Deschide referința API interactivă &rarr;</strong>
        </Link>{' '}
        · Specificație în format mașină la{' '}
        <Link href="/api/v1/openapi">
          <code>/api/v1/openapi</code>
        </Link>{' '}
        (OpenAPI 3.1 JSON).
      </p>

      <h2>Autentificare</h2>
      <pre>
        <code>Authorization: Bearer nk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
      </pre>
      <p>
        Cheile sunt verificate la fiecare cerere și au scope-uri. Scope-urile implicite sunt{' '}
        <code>notes:read notes:write</code>; token-urile sunt afișate o singură dată, la creare.
        Poți revoca oricând — apelurile vor returna <code>401</code> imediat după.
      </p>

      <h2>Endpoint-uri</h2>

      <h3>Listează notițele</h3>
      <pre>
        <code>{`GET ${BASE}/notes
Authorization: Bearer nk_...`}</code>
      </pre>
      <p>Returnează cele mai recent actualizate până la 50 de notițe ale deținătorului cheii.</p>
      <pre>
        <code>{`{
  "notes": [
    { "id": "abc", "title": "Hello", "icon": "\ud83d\udcdd", "kind": "note",
      "updatedAt": "2026-01-...", "createdAt": "2025-12-..." }
  ]
}`}</code>
      </pre>

      <h3>Creează o notiță</h3>
      <pre>
        <code>{`POST ${BASE}/notes
Authorization: Bearer nk_...
Content-Type: application/json

{
  "title": "From Zapier",
  "plaintext": "Body content...",
  "icon": "\ud83d\udcc5",
  "folderId": null
}`}</code>
      </pre>
      <p>
        Toate câmpurile sunt opționale. <code>plaintext</code> e limitat la 200.000 de caractere,{' '}
        <code>title</code> la 200. Returnează <code>201</code> cu <code>{`{ id, title }`}</code>.
      </p>

      <h3>Obține o notiță</h3>
      <pre>
        <code>{`GET ${BASE}/notes/{id}`}</code>
      </pre>

      <h3>Actualizează o notiță</h3>
      <pre>
        <code>{`PATCH ${BASE}/notes/{id}
Content-Type: application/json

{ "title": "New title", "plaintext": "Replaced body" }`}</code>
      </pre>

      <h3>Șterge (arhivează) o notiță</h3>
      <pre>
        <code>{`DELETE ${BASE}/notes/{id}`}</code>
      </pre>
      <p>
        Șterge logic notița (o mută la coșul de gunoi). Poate fi restaurată din interfața coșului în
        intervalul de retenție configurat.
      </p>

      <h2>Erori</h2>
      <ul>
        <li>
          <code>401 unauthorized</code> — bearer lipsă sau invalid
        </li>
        <li>
          <code>403 missing scope X</code> — tokenul nu are scope-ul necesar
        </li>
        <li>
          <code>400 invalid json</code> / validare — corectează payload-ul
        </li>
        <li>
          <code>404 not found</code> — notița nu aparține deținătorului cheii
        </li>
      </ul>

      <h2>Limite</h2>
      <p>
        API-ul folosește cota AI / de stocare la nivel de plan a fiecărui utilizator. Planurile Pro
        au throughput de scriere mai mare. Limită strictă de 200 KB pentru corpul cererii.
      </p>

      <h2>Exemplu curl</h2>
      <pre>
        <code>{`curl -H "Authorization: Bearer $NOTAI_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"title":"Test","plaintext":"hello"}' \\
     ${BASE}/notes`}</code>
      </pre>
    </>
  );
}

export default async function ApiDocsPage() {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return (
    <div className="prose prose-zinc dark:prose-invert mx-auto max-w-3xl px-6 py-12">
      {isRo ? <RoBody /> : <EnBody />}
    </div>
  );
}
