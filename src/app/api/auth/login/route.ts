import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { ownerPasswordHash, verifyPassword } from '@/lib/auth/password';
import { OWNER_GLOBAL, attempt, clearAttempts } from '@/lib/auth/rateLimit';
import { OWNER_COOKIE, OWNER_MAX_AGE, signOwnerSession } from '@/lib/auth/session';
import { clientIp, jsonError, secureCookies } from '@/lib/auth/guards';

export async function POST(req: NextRequest) {
  const repo = getRepo();
  const key = `owner:${clientIp(req)}`;
  const allowed = (await attempt(repo, key)) && (await attempt(repo, OWNER_GLOBAL.key, OWNER_GLOBAL.max));
  if (!allowed) return jsonError(429, 'locked');

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  const hash = ownerPasswordHash();
  if (!hash || !password || !(await verifyPassword(password, hash))) {
    return jsonError(401, 'wrong_password');
  }
  await clearAttempts(repo, key);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, await signOwnerSession(), {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: OWNER_MAX_AGE,
  });
  return res;
}
