import * as React from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card/40 mb-6 overflow-hidden rounded-2xl border backdrop-blur">
      {title || actions ? (
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <div>
            {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
            {description ? (
              <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div>{children}</div>
    </section>
  );
}

export { DataTable } from './data-table';
export { StatCard } from './stat-card';
