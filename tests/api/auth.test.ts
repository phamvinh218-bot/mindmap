import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { hashPassword } from '@/lib/auth/password';
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/auth/session';
import { requireOwner } from '@/lib/auth/guards';
import { proxy } from '@/proxy';
import { freshRepo, req, ownerCookies } from '../helpers';

let hash: string;
beforeAll(async () => {
  hash = await hashPassword('dung-mat-khau');
});
beforeEach(() => {
  vi.stubEnv('OWNER_PASSWORD_HASH', hash);
  freshRepo();
});

const attempt = (password: string, ip = '1.2.3.4') =>
  login(req('/api/auth/login', { method: 'POST', body: { password }, ip }));

describe('owner login', () => {
  it('rejects a wrong password with 401', async () => {
    const res = await attempt('sai');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'wrong_password' });
  });

  it('sets a 30-day httpOnly owner cookie on success', async () => {
    const res = await attempt('dung-mat-khau');
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${OWNER_COOKIE}=`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const jwt = res.cookies.get(OWNER_COOKIE)?.value;
    expect(await verifyOwnerSession(jwt)).toBe(true);
  });

  it('locks after 5 failures, even for the right password, per IP', async () => {
    for (let i = 0; i < 5; i++) expect((await attempt('sai')).status).toBe(401);
    const locked = await attempt('dung-mat-khau');
    expect(locked.status).toBe(429);
    expect(await locked.json()).toEqual({ error: 'locked' });
    expect((await attempt('dung-mat-khau', '9.9.9.9')).status).toBe(200);
  });

  it('logout clears the cookie', async () => {
    const res = await logout(req('/api/auth/logout', { method: 'POST' }));
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`${OWNER_COOKIE}=;.*Max-Age=0`, 'i'));
  });
});

describe('requireOwner', () => {
  it('returns 401 without a session and null with one', async () => {
    const denied = await requireOwner(req('/api/maps'));
    expect(denied?.status).toBe(401);
    expect(await requireOwner(req('/api/maps', { cookies: await ownerCookies() }))).toBeNull();
  });
});

describe('proxy', () => {
  it('redirects pages to /login without a session', async () => {
    const res = await proxy(req('/'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/login$/);
  });

  it('returns 401 JSON for owner APIs without a session', async () => {
    const res = await proxy(req('/api/maps'));
    expect(res.status).toBe(401);
  });

  it('lets an owner through', async () => {
    const res = await proxy(req('/m/abc', { cookies: await ownerCookies() }));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});
