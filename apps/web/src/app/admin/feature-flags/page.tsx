import { listFeatureFlags } from '@/server/actions/admin';
import { PageHeader, Section } from '../_components/primitives';
import { FlagsClient } from './client';

export const metadata = { title: 'Admin · Feature flags' };

export default async function AdminFlagsPage() {
  const flags = await listFeatureFlags();
  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Roll out experiments and gate features without redeploys."
      />
      <Section>
        <FlagsClient
          flags={flags.map((f) => ({
            key: f.key,
            description: f.description,
            defaultEnabled: f.defaultEnabled,
            rolloutPercent: f.rolloutPercent,
          }))}
        />
      </Section>
    </>
  );
}
