import { describe, it, expect, vi, afterEach } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  signOwnerSession, verifyOwnerSession, signShareSession, verifyShareSession, shareCookieName, generateShareToken,
} from '@/lib/auth/session';
import { isBlocked, recordFailure, RATE } from '@/lib/auth/rateLimit';
import { createMemoryRepo } from '@/lib/db/memoryRepo';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('password', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const h = await hashPassword('abc');
    expect(await verifyPassword('abc', h)).toBe(true);
    expect(await verifyPassword('abd', h)).toBe(false);
  });

  it('uses bcrypt cost 10', async () => {
    expect(await hashPassword('x')).toMatch(/^\$2[aby]\$10\$/);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('abc', 'not-a-hash')).toBe(false);
  });
});

describe('session', () => {
  it('owner session round-trips', async () => {
    expect(await verifyOwnerSession(await signOwnerSession())).toBe(true);
  });

  it('rejects tampered and missing owner sessions', async () => {
    const jwt = await signOwnerSession();
    expect(await verifyOwnerSession(jwt.slice(0, -2) + 'xx')).toBe(false);
    expect(await verifyOwnerSession(undefined)).toBe(false);
  });

  it('rejects an owner session signed with a different secret', async () => {
    const jwt = await signOwnerSession();
    vi.stubEnv('SESSION_SECRET', 'another-secret-another-secret-another-1');
    expect(await verifyOwnerSession(jwt)).toBe(false);
  });

  it('a share session is not accepted as an owner session', async () => {
    expect(await verifyOwnerSession(await signShareSession('s1', 1))).toBe(false);
  });

  it('share session round-trips shareId and session version', async () => {
    expect(await verifyShareSession(await signShareSession('s1', 3))).toEqual({ shareId: 's1', sv: 3 });
    expect(await verifyShareSession(await signOwnerSession())).toBeNull();
  });

  it('throws when SESSION_SECRET is too short', async () => {
    vi.stubEnv('SESSION_SECRET', 'short');
    await expect(signOwnerSession()).rejects.toThrow();
  });

  it('share cookie name is stable, token-specific and does not contain the token', () => {
    const t = generateShareToken();
    expect(shareCookieName(t)).toMatch(/^mm_sh_[0-9a-f]{16}$/);
    expect(shareCookieName(t)).toBe(shareCookieName(t));
    expect(shareCookieName(t)).not.toBe(shareCookieName(generateShareToken()));
  });

  it('share token is 43 url-safe chars and random', () => {
    const t = generateShareToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t).not.toBe(generateShareToken());
  });
});

describe('rate limit', () => {
  it('blocks after 5 failures and unblocks once the oldest ages out', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(start);
    const repo = createMemoryRepo();
    for (let i = 0; i < 4; i++) await recordFailure(repo, 'k');
    expect(await isBlocked(repo, 'k')).toBe(false);
    await recordFailure(repo, 'k');
    expect(await isBlocked(repo, 'k')).toBe(true);
    expect(await isBlocked(repo, 'other')).toBe(false);
    const later = new Date(start.getTime() + RATE.windowMs + 1);
    expect(await isBlocked(repo, 'k', later)).toBe(false);
  });
});
