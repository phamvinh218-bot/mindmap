import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { MIN_SHARE_PASSWORD, isUuid, publicShare, readJson } from '@/lib/api';
import { hashPassword } from '@/lib/auth/password';
import { generateShareToken } from '@/lib/auth/session';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id) || !(await getRepo().getMap(id))) return jsonError(404, 'not_found');
  const shares = await getRepo().listShares(id);
  return NextResponse.json(shares.map((s) => publicShare(req, s)));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  const repo = getRepo();
  if (!isUuid(id) || !(await repo.getMap(id))) return jsonError(404, 'not_found');
  const body = await readJson(req);
  const permission = body?.permission;
  if (permission !== 'view' && permission !== 'edit') return jsonError(400, 'invalid_permission');
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password.length < MIN_SHARE_PASSWORD) return jsonError(400, 'password_short');
  const label = typeof body?.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 100) : null;
  const share = await repo.createShare({
    map_id: id,
    token: generateShareToken(),
    label,
    permission,
    password_hash: await hashPassword(password),
  });
  return NextResponse.json(publicShare(req, share));
}
