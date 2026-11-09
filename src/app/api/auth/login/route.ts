import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { isBlocked, recordFailure } from '@/lib/auth/rateLimit';
import { OWNER_COOKIE, OWNER_MAX_AGE, signOwnerSession } from '@/lib/auth/session';
import { clientIp, jsonError, secureCookies } from '@/lib/auth/guards';

export async function POST(req: NextRequest) {
  const repo = getRepo();
  const key = `owner:${clientIp(req)}`;
  if (await isBlocked(repo, key)) return jsonError(429, 'locked');

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  const hash = process.env.OWNER_PASSWORD_HASH ?? '';
  if (!hash || !password || !(await verifyPassword(password, hash))) {
    await recordFailure(repo, key);
    return jsonError(401, 'wrong_password');
  }

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
