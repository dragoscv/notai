import { NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi-spec';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const spec = buildOpenApiSpec(base);
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
