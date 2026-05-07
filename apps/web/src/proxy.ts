import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Next.js 16 uses `proxy.ts` (formerly middleware.ts).
//
// NOTE: Auth.js v5 with `session.strategy: 'database'` cannot resolve the
// session in edge/proxy runtime (no DB access). All route protection is done
// server-side in layouts (see `app/layout.tsx`) and server actions. The proxy
// is intentionally a pass-through.
export function proxy(_req: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api/auth|api/oauth|api/mcp|\\.well-known|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons).*)',
    ],
};
