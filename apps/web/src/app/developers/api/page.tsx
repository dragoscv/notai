import Link from 'next/link';

export const metadata = {
  title: 'Notai Developer API',
  description:
    'Public REST API for creating, reading, and updating notes programmatically with bearer tokens.',
};

const BASE = 'https://notai.app/api/v1';

export default function ApiDocsPage() {
  return (
    <div className="prose prose-zinc dark:prose-invert mx-auto max-w-3xl px-6 py-12">
      <h1>Notai Developer API</h1>
      <p>
        A small REST surface so you can wire Notai into Zapier, n8n, your own scripts, or any place
        that can send an HTTP request. Authentication is by API key, generated in{' '}
        <Link href="/app/settings/api-keys">Settings &rarr; API keys</Link>.
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
    </div>
  );
}
