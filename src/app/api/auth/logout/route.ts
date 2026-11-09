import { NextResponse } from 'next/server';
import { OWNER_COOKIE } from '@/lib/auth/session';
import { secureCookies } from '@/lib/auth/guards';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, '', { httpOnly: true, secure: secureCookies(), sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
