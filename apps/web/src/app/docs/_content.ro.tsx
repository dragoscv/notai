import type { ReactNode } from 'react';
import type { DocArticle } from './_content.en';

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
    title: 'Primii pași',
    summary: 'Înregistrează-te, creează prima notiță și învață mișcările de bază.',
    group: 'Getting started',
    readingMinutes: 3,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Notai e un caiet calm pentru minți ADHD și creative. Deschide <Code>notai.ro</Code>,
          autentifică-te cu Google sau o passkey și ajungi pe dashboard cu patru notițe demo care
          îți arată cum merge.
        </P>
        <H2>Prima ta notiță</H2>
        <P>
          Apasă <Kbd>n</Kbd> de oriunde sau click pe <em>Notiță nouă</em>. Pune un titlu și începe
          să scrii în canvas. Desene, note lipicioase, atașamente și linkuri stau toate în același
          spațiu — nu există vreun „mod” în care trebuie să intri.
        </P>
        <H2>Cele patru taste cele mai utile</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>?</Kbd> — deschide cheatsheet-ul cu scurtături.
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> — paleta de comenzi: sari la orice notiță, rulează orice
            comandă.
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>N</Kbd> — captură rapidă: o notă lipicioasă care
            rămâne deasupra a tot.
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>J</Kbd> — sari la nota zilei de azi.
          </li>
        </ul>
        <H2>Unde stau notițele mele?</H2>
        <P>
          Implicit, notițele se sincronizează pe serverele noastre din UE (criptate în repaus și în
          tranzit). Poți folosi Notai și complet offline — fiecare schimbare e local-first și e
          reconciliată prin Y.js când revii online.
        </P>
      </div>
    ),
  },

  {
    slug: 'keyboard-shortcuts',
    title: 'Scurtături de tastatură',
    summary: 'Toate scurtăturile pe care Notai le înțelege, organizate pe suprafețe.',
    group: 'Getting started',
    readingMinutes: 4,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Apasă <Kbd>?</Kbd> oriunde în aplicație ca să deschizi cheatsheet-ul live. Lista de mai
          jos îl oglindește pentru referință și SEO.
        </P>
        <H2>Navigare</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> — paleta de comenzi
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>J</Kbd> — nota de azi
          </li>
          <li>
            <Kbd>g</Kbd> apoi <Kbd>d</Kbd> — dashboard · <Kbd>g</Kbd> apoi <Kbd>g</Kbd> —
            vizualizare graf
          </li>
        </ul>
        <H2>Captură</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>n</Kbd> — notiță nouă
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>N</Kbd> — notă lipicioasă de captură rapidă
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> pe dashboard — lipește imagine / URL într-o notă nouă
          </li>
        </ul>
        <H2>Editor</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>
            <Kbd>/</Kbd> — slash menu (rescriere AI, sumarizare, mind map etc.)
          </li>
          <li>
            <Kbd>[[</Kbd> — link către o altă notiță
          </li>
          <li>
            <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> — salvare forțată (oricum salvăm automat la fiecare tastă)
          </li>
        </ul>
      </div>
    ),
  },

  {
    slug: 'ai-features',
    title: 'Funcționalități AI',
    summary: 'Întreabă, sumarizează, mind-map, smart paste — și cum funcționează cotele.',
    group: 'Features',
    readingMinutes: 4,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Funcționalitățile AI din Notai rulează peste OpenAI. Conturile gratuite primesc o alocație
          lunară mică ca să încerce; Pro elimină limita.
        </P>
        <H2>Întreabă-mi notițele</H2>
        <P>
          Deschide paleta de comenzi și alege <em>Întreabă</em>, sau vizitează <Code>/app/ask</Code>
          . Generăm embedding-uri pentru notițele tale o singură dată, apoi rulăm căutare semantică
          + sinteză LLM cu citări. Răspunsurile vin token-cu-token.
        </P>
        <H2>Slash menu în notă</H2>
        <P>
          Tastează <Kbd>/</Kbd> în orice notă și alege o acțiune: <em>Rescrie</em>,{' '}
          <em>Sumarizează</em>, <em>Mind map</em>, <em>Tradu</em>, <em>Fă o listă</em>. Modificarea
          propusă apare într-un panou de revizuire — nimic nu se aplică până nu accepți.
        </P>
        <H2>Smart paste</H2>
        <P>
          Lipești un URL lung, o transcripție sau o bucată de text și Notai extrage punctele cheie,
          tag-urile și un titlu. Folosește <Code>Ctrl</Code>+<Code>V</Code> pe dashboard sau în
          interiorul unei note.
        </P>
        <H2>Cote</H2>
        <P>
          Planul gratuit include o alocație lunară de AI generoasă. Când o termini, Notai arată un
          prompt inline de upgrade — notițele tale tot se salvează, doar funcționalitățile AI sunt
          pe pauză. Vezi{' '}
          <a href="/pricing" className="text-primary underline">
            tarife
          </a>{' '}
          pentru limitele curente.
        </P>
      </div>
    ),
  },

  {
    slug: 'sync-and-storage',
    title: 'Sincronizare, stocare și confidențialitate',
    summary: 'Unde stau notițele tale, ce stocăm și cum exporți totul.',
    group: 'Features',
    readingMinutes: 5,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <H2>Unde sunt stocate notițele</H2>
        <P>
          Găzduim pe Google Cloud Platform în <strong>europe-west1</strong> (Belgia). PostgreSQL
          pentru metadatele notițelor, Cloud Storage pentru atașamente. Colaborarea în timp real
          rulează pe un server Hocuspocus dedicat cu CRDT-uri Y.js.
        </P>
        <H2>Ce nu facem</H2>
        <ul className="text-muted-foreground space-y-2 leading-relaxed">
          <li>Nu antrenăm niciun AI pe notițele tale.</li>
          <li>Nu vindem și nu împărțim datele tale cu terți.</li>
          <li>Nu scanăm notițele pentru reclame sau analytics. Rapoartele Sentry sunt anonime.</li>
        </ul>
        <H2>Export</H2>
        <P>
          Setări &rarr; Cont &rarr; <em>Exportă notițele</em> descarcă un ZIP cu toate notițele ca
          Markdown. <em>Descarcă toate datele mele</em> descarcă un dump JSON care satisface
          Articolul 15 GDPR (drept de acces) și Articolul 20 (portabilitate).
        </P>
        <H2>Șterge-ți contul</H2>
        <P>
          Setări &rarr; Cont &rarr; <em>Șterge contul</em>. Marcam contul pentru ștergere și îl
          curățăm după o perioadă de grație de 30 de zile (în care poți anula). Datele șterse
          definitiv nu pot fi recuperate.
        </P>
      </div>
    ),
  },

  {
    slug: 'billing',
    title: 'Planuri și facturare',
    summary: 'Cum funcționează abonamentele, rambursările și gestionarea planului.',
    group: 'Account & billing',
    readingMinutes: 3,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <H2>Planuri</H2>
        <P>
          Notai e gratuit pentru uz personal cu limite generoase. Pro adaugă cote AI mai mari,
          atașamente mai mari și suport prioritar. Vezi{' '}
          <a href="/pricing" className="text-primary underline">
            tarife
          </a>{' '}
          pentru detaliile curente.
        </P>
        <H2>Plată</H2>
        <P>
          Plățile sunt gestionate de Stripe. Nu vedem și nu stocăm cardul tău. Poți plăti lunar sau
          anual; schimbarea planului se aplică imediat și e pro-rata.
        </P>
        <H2>Rambursări</H2>
        <P>
          Oferim un drept de retragere de 14 zile pentru abonamente noi (legislație consumator UE).
          După aceea, rambursăm pro-rata partea neutilizată a perioadei de facturare — scrie la{' '}
          <a href="mailto:billing@notai.ro" className="text-primary underline">
            billing@notai.ro
          </a>
          .
        </P>
        <H2>Facturi</H2>
        <P>
          Stripe trimite automat fiecare factură pe email-ul tău de facturare; poți de asemenea să
          le iei din portalul de customer la Setări &rarr; Cont &rarr;{' '}
          <em>Gestionează abonamentul</em>.
        </P>
      </div>
    ),
  },

  {
    slug: 'api',
    title: 'API REST public',
    summary: 'Acces programatic prin token-uri personale.',
    group: 'Developers',
    readingMinutes: 4,
    updated: '2026-05-11',
    body: (
      <div className="space-y-4">
        <P>
          Notai expune un mic REST API pentru listare, citire, creare și actualizare a notițelor.
          Specificația completă e la <Code>/api/v1/openapi</Code>.
        </P>
        <H2>Obține un token</H2>
        <P>
          Setări &rarr; API keys &rarr; <em>New key</em>. Alege scope-urile (<Code>notes:read</Code>
          , <Code>notes:write</Code>) și copiază token-ul <Code>nk_&hellip;</Code>. E afișat o
          singură dată.
        </P>
        <H2>Fă o cerere</H2>
        <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">
          {`curl https://notai.ro/api/v1/notes \\\n  -H "Authorization: Bearer nk_..."`}
        </pre>
        <H2>Limite de rată</H2>
        <P>
          Citiri: 60 cereri/min per cheie. Scrieri: 30 cereri/min per cheie. Depășirea returnează
          429 cu un header <Code>Retry-After</Code>.
        </P>
        <H2>Webhook-uri</H2>
        <P>
          Configurează webhook-uri de ieșire din Setări &rarr; Webhooks. Fiecare livrare e semnată
          cu HMAC-SHA256 (secret afișat la creare) și reîncercată cu exponential backoff la
          răspunsuri non-2xx. Livrările eșuate sunt vizibile și replayabile din dashboard.
        </P>
      </div>
    ),
  },
];
