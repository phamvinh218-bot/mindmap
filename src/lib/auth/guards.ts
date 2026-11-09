import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '../db';
import type { ShareRow } from '../db/repo';
import { OWNER_COOKIE, shareCookieName, verifyOwnerSession, verifyShareSession } from './session';

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

/** null = authorized owner; otherwise a 401 response to return. */
export async function requireOwner(req: NextRequest): Promise<NextResponse | null> {
  if (await verifyOwnerSession(req.cookies.get(OWNER_COOKIE)?.value)) return null;
  return jsonError(401, 'unauthorized');
}

/**
 * Validates the share session cookie for this token. Permission and enabled state
 * are read from the database on every call, so owner changes apply immediately.
 */
export async function requireShare(
  req: NextRequest,
  token: string,
): Promise<{ share: ShareRow } | { response: NextResponse }> {
  const session = await verifyShareSession(req.cookies.get(shareCookieName(token))?.value);
  if (!session) return { response: jsonError(401, 'unauthorized') };
  const share = await getRepo().getShareByToken(token);
  if (!share || !share.enabled || share.id !== session.shareId || share.session_version !== session.sv) {
    return { response: jsonError(401, 'unauthorized') };
  }
  return { share };
}

export const secureCookies = () => process.env.NODE_ENV === 'production';
