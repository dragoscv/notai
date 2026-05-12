import type { ReactNode } from 'react';

/**
 * Static docs site content. Each entry maps a URL slug to a section of
 * the public documentation at /docs/[slug]. To add a new article, add
 * a new entry here — sitemap, index page, and dynamic route pick it up
 * automatically.
 */
export interface DocArticle {
  slug: string;
  title: string;
  summary: string;
  group: 'Getting started' | 'Features' | 'Account & billing' | 'Developers';
  readingMinutes: number;
  updated: string;
  body: ReactNode;
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground leading-relaxed">{children}</p>
);

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-10 text-2xl font-semibold tracking-tight">{children}</h2>
);

const Code = ({ children }: { children: ReactNode }) => (
  <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">{children}</code>
);

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="bg-muted border-border/60 rounded border px-1.5 py-0.5 font-mono text-xs">
    {children}
  </kbd>
);

export const DOCS: DocArticle[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'Sign up, create your first note, and learn the core moves.',
    group: 'Getting started',
    readingMinutes: 3,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Notai is a calm notebook for ADHD and creative minds. Open <Code>notai.ro</Code>, sign in
          with Google or a passkey, and you&rsquo;ll land on the dashboard with four seeded notes
          that show you the ropes.
        </P>
        <H2>Your first note</H2>
        <P>
          Press <Kbd>n</Kbd> from anywhere or click <em>New note</em>. Type a title, then start
          writing in the canvas. Drawings, sticky notes, attachments, and links all live in the same
          space &mdash; there is no &ldquo;mode&rdquo; you have to switch into.
        </P>
        <H2>The four most useful keys</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>?</Kbd> &mdash; open the keyboard-shortcut cheatsheet.
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> &mdash; command palette: jump to any note, run any command.
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>N</Kbd> &mdash; quick capture: a sticky note that
            stays on top of everything.
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>J</Kbd> &mdash; jump to today&rsquo;s daily note.
          </li>
        </ul>
        <H2>Where do my notes live?</H2>
        <P>
          By default, notes sync to our servers in the EU (encrypted at rest and in transit). You
          can also use Notai fully offline &mdash; every change you make is local-first and
          reconciled via Y.js when you come back online.
        </P>
      </div>
    ),
  },

  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard shortcuts',
    summary: 'Every shortcut Notai understands, organized by surface.',
    group: 'Getting started',
    readingMinutes: 4,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Press <Kbd>?</Kbd> anywhere in the app to open the live cheatsheet. The list below mirrors
          it for reference and SEO.
        </P>
        <H2>Navigation</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> &mdash; command palette
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>J</Kbd> &mdash; today&rsquo;s note
          </li>
          <li>
            <Kbd>g</Kbd> then <Kbd>d</Kbd> &mdash; dashboard &middot; <Kbd>g</Kbd> then <Kbd>g</Kbd>{' '}
            &mdash; graph view
          </li>
        </ul>
        <H2>Capture</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>n</Kbd> &mdash; new note
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>N</Kbd> &mdash; quick capture sticky
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> on dashboard &mdash; paste image / URL into a fresh note
          </li>
        </ul>
        <H2>Editor</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>/</Kbd> &mdash; slash menu (AI rewrite, summarize, mind map, etc.)
          </li>
          <li>
            <Kbd>[[</Kbd> &mdash; link to another note
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> &mdash; force-save (autosaves on every keystroke anyway)
          </li>
        </ul>
      </div>
    ),
  },

  {
    slug: 'ai-features',
    title: 'AI features',
    summary: 'Ask, summarize, mind-map, smart paste — and how quotas work.',
    group: 'Features',
    readingMinutes: 4,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Notai&rsquo;s AI features run on top of OpenAI. Free accounts get a small monthly
          allowance for trying things out; Pro removes the cap.
        </P>
        <H2>Ask my notes</H2>
        <P>
          Open the command palette and pick <em>Ask</em>, or visit <Code>/app/ask</Code>. We embed
          your notes once, then run a semantic search + LLM synthesis with citations. Answers stream
          back token-by-token.
        </P>
        <H2>Slash menu inside a note</H2>
        <P>
          Type <Kbd>/</Kbd> in any note and pick an action: <em>Rewrite</em>, <em>Summarize</em>,{' '}
          <em>Mind map</em>, <em>Translate</em>, <em>Make a checklist</em>. The proposed change is
          shown in a review pane &mdash; nothing is applied until you accept it.
        </P>
        <H2>Smart paste</H2>
        <P>
          Paste a long URL, transcript, or chunk of text and Notai will extract the key points,
          tags, and a title. Use <Code>Ctrl</Code>+<Code>V</Code> on the dashboard or inside a note.
        </P>
        <H2>Quotas</H2>
        <P>
          The free plan includes a generous monthly AI allowance. When you run out, Notai shows an
          inline upgrade prompt &mdash; your notes still save, only the AI features pause. See{' '}
          <a href="/pricing" className="text-primary underline">
            pricing
          </a>{' '}
          for current limits.
        </P>
      </div>
    ),
  },

  {
    slug: 'sync-and-storage',
    title: 'Sync, storage & privacy',
    summary: 'Where your notes live, what we store, and how to export everything.',
    group: 'Features',
    readingMinutes: 5,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <H2>Where notes are stored</H2>
        <P>
          We host on Google Cloud Platform in <strong>europe-west1</strong> (Belgium). PostgreSQL
          for note metadata, Cloud Storage for attachments. Realtime collaboration runs on a
          dedicated Hocuspocus server with Y.js CRDTs.
        </P>
        <H2>What we don&rsquo;t do</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>We don&rsquo;t train any AI on your notes.</li>
          <li>We don&rsquo;t sell or share your data with third parties.</li>
          <li>
            We don&rsquo;t scan your notes for ads or analytics. Sentry crash reports are anonymous.
          </li>
        </ul>
        <H2>Export</H2>
        <P>
          Settings &rarr; Account &rarr; <em>Export your notes</em> downloads a ZIP of every note as
          Markdown. <em>Download all my data</em> downloads a JSON dump satisfying GDPR Article 15
          (right of access) and Article 20 (data portability).
        </P>
        <H2>Delete your account</H2>
        <P>
          Settings &rarr; Account &rarr; <em>Delete account</em>. We mark the account for deletion
          and purge it after a 30-day grace period (during which you can cancel). Hard-deleted data
          is unrecoverable.
        </P>
      </div>
    ),
  },

  {
    slug: 'billing',
    title: 'Plans & billing',
    summary: 'How subscriptions work, refunds, and managing your plan.',
    group: 'Account & billing',
    readingMinutes: 3,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <H2>Plans</H2>
        <P>
          Notai is free for personal use with generous limits. Pro adds higher AI quotas, larger
          attachments, and priority support. See{' '}
          <a href="/pricing" className="text-primary underline">
            pricing
          </a>{' '}
          for current details.
        </P>
        <H2>Payment</H2>
        <P>
          Payments are handled by Stripe. We never see or store your card. You can pay monthly or
          yearly; switching plans takes effect immediately and is pro-rated.
        </P>
        <H2>Refunds</H2>
        <P>
          We offer a 14-day right of withdrawal for new subscriptions (EU consumer law). After that,
          we pro-rate refunds for the unused portion of your billing period &mdash; email{' '}
          <a href="mailto:billing@notai.ro" className="text-primary underline">
            billing@notai.ro
          </a>
          .
        </P>
        <H2>Invoices</H2>
        <P>
          Stripe sends every invoice to your billing email automatically and you can also fetch them
          from the customer portal at Settings &rarr; Account &rarr; <em>Manage subscription</em>.
        </P>
      </div>
    ),
  },

  {
    slug: 'api',
    title: 'Public REST API',
    summary: 'Programmatic access via personal access tokens.',
    group: 'Developers',
    readingMinutes: 4,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Notai exposes a small REST API for listing, reading, creating, and updating notes. The
          full spec is at <Code>/api/v1/openapi</Code>.
        </P>
        <H2>Get a token</H2>
        <P>
          Settings &rarr; API keys &rarr; <em>New key</em>. Pick scopes (<Code>notes:read</Code>,{' '}
          <Code>notes:write</Code>) and copy the <Code>nk_&hellip;</Code> token. It&rsquo;s shown
          only once.
        </P>
        <H2>Make a request</H2>
        <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">
          {`curl https://notai.ro/api/v1/notes \\\n  -H "Authorization: Bearer nk_..."`}
        </pre>
        <H2>Rate limits</H2>
        <P>
          Reads: 60 req/min per key. Writes: 30 req/min per key. Exceeding either returns 429 with a{' '}
          <Code>Retry-After</Code> header.
        </P>
        <H2>Webhooks</H2>
        <P>
          Configure outbound webhooks in Settings &rarr; Webhooks. Each delivery is signed with
          HMAC-SHA256 (secret shown on creation) and retried with exponential backoff on non-2xx
          responses. Failed deliveries are visible and replayable in the dashboard.
        </P>
      </div>
    ),
  },
];

export const DOCS_BY_SLUG = new Map(DOCS.map((d) => [d.slug, d]));
