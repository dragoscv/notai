# @notai/sdk

Official TypeScript client for the [Notai](https://notai.app) REST
API.

## Install

```bash
pnpm add @notai/sdk
```

## Use

```ts
import { NotaiClient } from '@notai/sdk';

const notai = new NotaiClient({ apiKey: process.env.NOTAI_KEY! });

// List notes
const notes = await notai.notes.list();

// Create
const created = await notai.notes.create({
  title: 'From script',
  plaintext: 'Body...',
});

// Update
await notai.notes.update(created.id, { title: 'Renamed' });

// Archive
await notai.notes.delete(created.id);
```

## Self-hosted

```ts
new NotaiClient({ apiKey, baseUrl: 'https://my-notai.example.com' });
```

## Errors

All non-2xx responses throw `NotaiApiError` with the HTTP status and
the server's `error` message.
