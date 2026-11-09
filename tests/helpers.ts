import { NextRequest } from 'next/server';
import { createMemoryRepo } from '@/lib/db/memoryRepo';
import { setRepo } from '@/lib/db';
import { OWNER_COOKIE, signOwnerSession } from '@/lib/auth/session';
import type { Repo } from '@/lib/db/repo';

export function freshRepo(): Repo {
  const repo = createMemoryRepo();
  setRepo(repo);
  return repo;
}

export function req(
  url: string,
  init: { method?: string; body?: unknown; cookies?: Record<string, string>; ip?: string; headers?: Record<string, string> } = {},
): NextRequest {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (init.cookies) {
    headers.set('cookie', Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  }
  headers.set('x-forwarded-for', init.ip ?? '1.2.3.4');
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function ownerCookies(): Promise<Record<string, string>> {
  return { [OWNER_COOKIE]: await signOwnerSession() };
}

export function ctx<P extends Record<string, string>>(params: P): { params: Promise<P> } {
  return { params: Promise.resolve(params) };
}
