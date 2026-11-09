import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const OWNER_COOKIE = 'mm_owner';
export const OWNER_MAX_AGE = 30 * 24 * 60 * 60; // seconds
export const SHARE_MAX_AGE = 7 * 24 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return new TextEncoder().encode(s);
}

async function sign(payload: Record<string, unknown>, maxAgeSec: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(secret());
}

async function verify(jwt: string | undefined): Promise<Record<string, unknown> | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret(), { algorithms: ['HS256'] });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function signOwnerSession(): Promise<string> {
  return sign({ kind: 'owner' }, OWNER_MAX_AGE);
}

export async function verifyOwnerSession(jwt: string | undefined): Promise<boolean> {
  const p = await verify(jwt);
  return p?.kind === 'owner';
}

export function signShareSession(shareId: string, sessionVersion: number): Promise<string> {
  return sign({ kind: 'share', shareId, sv: sessionVersion }, SHARE_MAX_AGE);
}

export async function verifyShareSession(jwt: string | undefined): Promise<{ shareId: string; sv: number } | null> {
  const p = await verify(jwt);
  if (p?.kind !== 'share' || typeof p.shareId !== 'string' || typeof p.sv !== 'number') return null;
  return { shareId: p.shareId, sv: p.sv };
}

export function shareCookieName(token: string): string {
  return 'mm_sh_' + createHash('sha256').update(token).digest('hex').slice(0, 16);
}

export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}
