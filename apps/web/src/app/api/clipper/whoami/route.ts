import { NextResponse } from 'next/server';
import { authenticatePat, requireScope } from '@/server/pat-auth';

export async function GET(req: Request) {
  const auth = await authenticatePat(req);
  if (auth instanceof NextResponse) return auth;
  const scoped = requireScope(auth, 'clipper');
  if (scoped) return scoped;
  return NextResponse.json({ userId: auth.userId, email: auth.email, scopes: auth.scopes });
}
