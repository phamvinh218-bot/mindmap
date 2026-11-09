import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireShare } from '@/lib/auth/guards';
import { readJson, saveMap } from '@/lib/api';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const auth = await requireShare(req, token);
  if ('response' in auth) return auth.response;
  const map = await getRepo().getMap(auth.share.map_id);
  if (!map) return jsonError(404, 'not_found');
  return NextResponse.json({ title: map.title, data: map.data, version: map.version, permission: auth.share.permission });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const auth = await requireShare(req, token);
  if ('response' in auth) return auth.response;
  if (auth.share.permission !== 'edit') return jsonError(403, 'read_only');
  return saveMap(getRepo(), auth.share.map_id, await readJson(req));
}
