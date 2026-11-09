import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getRepo } from '@/lib/db';
import { jsonError } from '@/lib/auth/guards';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Vercel Cron, once a day: keeps the free Supabase project awake and trims old login attempts. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return jsonError(401, 'unauthorized');
  const repo = getRepo();
  await repo.ping();
  await repo.purgeAttemptsBefore(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return NextResponse.json({ ok: true });
}
