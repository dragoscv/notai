import { NextResponse } from 'next/server';
import { authenticatePat } from '@/server/pat-auth';

export async function GET(req: Request) {
  const auth = await authenticatePat(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ userId: auth.userId, email: auth.email });
}
