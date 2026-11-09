import { NextResponse } from 'next/server';
import { validateMapData } from './schema';
import type { Repo, ShareRow } from './db/repo';
import { jsonError } from './auth/guards';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const body = await req.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export const MAX_TITLE = 200;

/** Trimmed title, or null when missing/blank/too long. */
export function parseTitle(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.length <= MAX_TITLE ? t : null;
}

export const COPY_SUFFIX = ' (bản sao)';
export function copyTitle(title: string): string {
  return (title + COPY_SUFFIX).slice(-MAX_TITLE);
}

/** Shared by the owner and share save endpoints. */
export async function saveMap(repo: Repo, mapId: string, body: Record<string, unknown> | null): Promise<NextResponse> {
  const version = body?.version;
  if (typeof version !== 'number' || !Number.isInteger(version)) return jsonError(400, 'invalid');
  const v = validateMapData(body?.data);
  if (!v.ok) return jsonError(v.error === 'too_large' ? 413 : 400, v.error);
  const r = await repo.saveMapData(mapId, v.data, version);
  if (r.ok) return NextResponse.json({ version: r.version });
  if (r.reason === 'conflict') return jsonError(409, 'conflict', { version: r.version });
  return jsonError(404, 'not_found');
}

export function slug(title: string): string {
  const s = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'mindmap';
}


export const MIN_SHARE_PASSWORD = 4;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export const isShareToken = (t: string) => TOKEN_RE.test(t);

export function shareUrl(req: Request, token: string): string {
  return `${new URL(req.url).origin}/s/${token}`;
}

/** What the owner sees about a share — never the password hash. */
export function publicShare(req: Request, s: ShareRow) {
  return {
    id: s.id,
    label: s.label,
    permission: s.permission,
    enabled: s.enabled,
    url: shareUrl(req, s.token),
    created_at: s.created_at,
    last_used_at: s.last_used_at,
  };
}
