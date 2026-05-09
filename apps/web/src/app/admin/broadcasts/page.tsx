import { listBroadcasts } from '@/server/actions/admin';
import { PageHeader, Section } from '../_components/primitives';
import { BroadcastsClient } from './client';

export const metadata = { title: 'Admin · Broadcasts' };

export default async function AdminBroadcastsPage() {
  const list = await listBroadcasts();
  return (
    <>
      <PageHeader
        title="Broadcasts"
        description="Compose announcements and email blasts to user segments."
      />
      <Section>
        <BroadcastsClient
          broadcasts={list.map((b) => ({
            id: b.id,
            title: b.title,
            body: b.body,
            status: b.status,
            scheduledFor: b.scheduledFor,
            sentAt: b.sentAt,
            createdAt: b.createdAt,
          }))}
        />
      </Section>
    </>
  );
}
