import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import type { SharePatch } from '@/lib/db/repo';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { MIN_SHARE_PASSWORD, isUuid, publicShare, readJson } from '@/lib/api';
import { hashPassword } from '@/lib/auth/password';

type Ctx = { params: Promise<{ shareId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { shareId } = await params;
  const repo = getRepo();
  const current = isUuid(shareId) ? await repo.getShare(shareId) : null;
  if (!current) return jsonError(404, 'not_found');
  const body = (await readJson(req)) ?? {};
  const patch: SharePatch = {};
  let endSessions = false;

  if ('label' in body) {
    patch.label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 100) : null;
  }
  if ('permission' in body) {
    if (body.permission !== 'view' && body.permission !== 'edit') return jsonError(400, 'invalid_permission');
    patch.permission = body.permission;
  }
  if ('password' in body) {
    if (typeof body.password !== 'string' || body.password.length < MIN_SHARE_PASSWORD) {
      return jsonError(400, 'password_short');
    }
    patch.password_hash = await hashPassword(body.password);
    endSessions = true;
  }
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') return jsonError(400, 'invalid');
    patch.enabled = body.enabled;
    if (!body.enabled) endSessions = true;
  }
  if (endSessions) patch.session_version = current.session_version + 1;

  const updated = await repo.updateShare(shareId, patch);
  if (!updated) return jsonError(404, 'not_found');
  return NextResponse.json(publicShare(req, updated));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { shareId } = await params;
  if (!isUuid(shareId) || !(await getRepo().deleteShare(shareId))) return jsonError(404, 'not_found');
  return new NextResponse(null, { status: 204 });
}
