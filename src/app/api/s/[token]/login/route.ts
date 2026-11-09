import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { clientIp, jsonError, secureCookies } from '@/lib/auth/guards';
import { isShareToken, readJson } from '@/lib/api';
import { verifyPassword } from '@/lib/auth/password';
import { isBlocked, recordFailure } from '@/lib/auth/rateLimit';
import { SHARE_MAX_AGE, shareCookieName, signShareSession } from '@/lib/auth/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const repo = getRepo();
  const share = isShareToken(token) ? await repo.getShareByToken(token) : null;
  if (!share || !share.enabled) return jsonError(404, 'not_found');

  const key = `share:${token}:${clientIp(req)}`;
  if (await isBlocked(repo, key)) return jsonError(429, 'locked');
  const body = await readJson(req);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || !(await verifyPassword(password, share.password_hash))) {
    await recordFailure(repo, key);
    return jsonError(401, 'wrong_password');
  }

  await repo.updateShare(share.id, { last_used_at: new Date().toISOString() });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(shareCookieName(token), await signShareSession(share.id, share.session_version), {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: SHARE_MAX_AGE,
  });
  return res;
}
