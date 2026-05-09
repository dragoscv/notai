import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAdmin } from '@/server/rbac';
import { AdminShell } from './_components/admin-shell';

export const metadata = { title: 'Admin · Notai' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/admin');
  if (!(await isAdmin())) redirect('/');
  return (
    <AdminShell
      user={{
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      }}
    >
      {children}
    </AdminShell>
  );
}
