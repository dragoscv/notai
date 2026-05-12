import Link from 'next/link';
import { LEGAL } from '@/lib/legal-info';
import type { FaqContent } from './_content.types';

export const content: FaqContent = {
  pageTitle: 'Frequently asked questions',
  pageSubtitle:
    "Quick answers to the questions we hear most often. Can't find yours? Open a ticket.",
  stillStuckTitle: 'Still stuck?',
  stillStuck: (
    <p>
      <Link href="/support/new">Open a support ticket</Link> or email{' '}
      <a href={`mailto:${LEGAL.emails.support}`}>{LEGAL.emails.support}</a>.
    </p>
  ),
  sections: [
    {
      title: 'Getting started',
      items: [
        {
          q: 'What is Notai?',
          a: (
            <>
              Notai is a local-first notes app with optional cloud sync. Your notes live in your
              browser or desktop app and only sync to our servers if you choose. We support rich
              text, checklists, attachments, drawings (Excalidraw), and sticky notes.
            </>
          ),
        },
        {
          q: 'Do I need an account?',
          a: (
            <>
              No. You can use the web app and the desktop app fully offline without signing in.
              Cloud sync, sharing, and backups require a free account.
            </>
          ),
        },
        {
          q: 'Which platforms are supported?',
          a: (
            <>
              Web (any modern browser), Windows desktop (signed installer + Microsoft Store), macOS
              (notarized), and a Chrome/Edge web clipper extension. Mobile apps are on the roadmap.
            </>
          ),
        },
      ],
    },
    {
      title: 'Plans & billing',
      items: [
        {
          q: 'Is there a free plan?',
          a: (
            <>
              Yes. The Free plan covers personal use with up to 50 cloud-synced notes, 50&nbsp;MB of
              attachments, and 7 days of version history. Local notes are unlimited.
            </>
          ),
        },
        {
          q: 'How do I upgrade?',
          a: (
            <>
              From the in-app billing settings or the public{' '}
              <a className="underline" href="/pricing">
                pricing page
              </a>
              . Payments are handled by Stripe; we never see your card details.
            </>
          ),
        },
        {
          q: 'Can I cancel anytime?',
          a: (
            <>
              Yes. You can cancel from the billing portal in settings. Your plan stays active until
              the end of the current period. We never auto-bill once you cancel.
            </>
          ),
        },
        {
          q: 'Do you offer refunds?',
          a: (
            <>
              EU consumers have a {LEGAL.refund.rightOfWithdrawalDays}-day right of withdrawal under
              OUG&nbsp;34/2014, and we honour it pro-rata for usage. Full details on the{' '}
              <a className="underline" href="/refund">
                refund policy
              </a>{' '}
              page.
            </>
          ),
        },
        {
          q: 'Which currencies do you accept?',
          a: <>EUR, USD, and RON. The currency follows your billing country.</>,
        },
      ],
    },
    {
      title: 'Privacy & data',
      items: [
        {
          q: 'Where is my data stored?',
          a: (
            <>
              Locally in your browser/desktop app first. If you enable cloud sync,
              encrypted-in-transit copies live on managed PostgreSQL inside the EU (Google Cloud,
              Frankfurt / Belgium, depending on the project) and Cloudflare R2 for attachments.
            </>
          ),
        },
        {
          q: 'Do you train AI on my notes?',
          a: <>No. Your notes are never used to train AI models. AI features run on demand only.</>,
        },
        {
          q: 'How do I export or delete my data?',
          a: (
            <>
              You can export everything from <em>Settings → Account</em> as a Markdown ZIP, or
              delete your account permanently from the same screen. Deletion removes your data from
              our servers within 30 days.
            </>
          ),
        },
        {
          q: 'Are you GDPR-compliant?',
          a: (
            <>
              Yes. The full{' '}
              <a className="underline" href="/privacy-policy">
                privacy policy
              </a>{' '}
              describes our lawful bases, data subject rights, and retention. Data subject requests
              go to{' '}
              <a className="underline" href={`mailto:${LEGAL.emails.privacy}`}>
                {LEGAL.emails.privacy}
              </a>
              .
            </>
          ),
        },
      ],
    },
    {
      title: 'Sync & collaboration',
      items: [
        {
          q: 'How does sync work?',
          a: (
            <>
              Notes use CRDTs (Yjs over Hocuspocus) so edits from multiple devices merge without
              conflicts. Sticky notes mirror the parent note in real time.
            </>
          ),
        },
        {
          q: 'Can I share a note?',
          a: (
            <>
              Yes — view-only or edit links, optionally protected by a password and an expiry date.
              Pro adds custom slugs.
            </>
          ),
        },
        {
          q: 'Can I work offline?',
          a: <>Always. Changes queue locally and sync the moment you&rsquo;re back online.</>,
        },
      ],
    },
    {
      title: 'Account & security',
      items: [
        {
          q: 'How do I sign in?',
          a: (
            <>
              Google sign-in via Auth.js, plus passkeys (Touch ID, Face ID, Windows Hello, or any
              FIDO2 hardware key). Add a passkey under{' '}
              <Link className="underline" href="/app/settings/security">
                Settings → Security
              </Link>
              .
            </>
          ),
        },
        {
          q: 'I lost access to my email — what now?',
          a: (
            <>
              Open a{' '}
              <Link className="underline" href="/support/new">
                support ticket
              </Link>{' '}
              with the category &ldquo;Account help&rdquo; and we&rsquo;ll verify your identity
              before transferring access.
            </>
          ),
        },
        {
          q: 'I think I found a security issue.',
          a: (
            <>
              Please email{' '}
              <a className="underline" href={`mailto:${LEGAL.emails.abuse}`}>
                {LEGAL.emails.abuse}
              </a>{' '}
              with details. We do not run a paid bug bounty yet, but we credit responsible
              disclosures.
            </>
          ),
        },
      ],
    },
  ],
  schemaItems: [
    {
      question: 'What is Notai?',
      answer:
        'Notai is a local-first notes app with optional cloud sync. Your notes live in your browser or desktop app and only sync to our servers if you choose. We support rich text, checklists, attachments, drawings (Excalidraw), and sticky notes.',
    },
    {
      question: 'Do I need an account?',
      answer:
        'No. You can use the web app and the desktop app fully offline without signing in. Cloud sync, sharing, and backups require a free account.',
    },
    {
      question: 'Which platforms are supported?',
      answer:
        'Web (any modern browser), Windows desktop (signed installer + Microsoft Store), macOS (notarized), and a Chrome/Edge web clipper extension. Mobile apps are on the roadmap.',
    },
    {
      question: 'Is there a free plan?',
      answer:
        'Yes. The Free plan covers personal use with up to 50 cloud-synced notes, 50 MB of attachments, and 7 days of version history. Local notes are unlimited.',
    },
    {
      question: 'Where is my data stored?',
      answer:
        'Notes you choose to sync are stored in our PostgreSQL database hosted on Google Cloud (region: europe-west3, Frankfurt). Attachments live in Google Cloud Storage in the same region. Local-only notes never leave your device.',
    },
    {
      question: 'Is Notai GDPR-compliant?',
      answer:
        'Yes. Notai is operated from Romania (EU), data lives in the EU, and we provide full data export and account deletion from Settings. See our Privacy Policy for the data processing details.',
    },
  ],
};
