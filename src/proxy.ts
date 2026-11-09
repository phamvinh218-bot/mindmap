import { NextResponse, type NextRequest } from 'next/server';
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/auth/session';

/**
 * Optimistic owner gate for owner pages and owner APIs. Route handlers check again
 * (requireOwner), so this is not the only line of defense.
 */
export async function proxy(req: NextRequest) {
  const ok = await verifyOwnerSession(req.cookies.get(OWNER_COOKIE)?.value);
  if (ok) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/', '/m/:path*', '/api/maps/:path*', '/api/maps', '/api/shares/:path*'],
};
