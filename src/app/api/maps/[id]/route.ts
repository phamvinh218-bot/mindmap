import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { isUuid, parseTitle, readJson } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  const map = isUuid(id) ? await getRepo().getMap(id) : null;
  if (!map) return jsonError(404, 'not_found');
  return NextResponse.json({ id: map.id, title: map.title, data: map.data, version: map.version });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  const title = parseTitle((await readJson(req))?.title);
  if (!title) return jsonError(400, 'invalid_title');
  if (!isUuid(id) || !(await getRepo().renameMap(id, title))) return jsonError(404, 'not_found');
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id) || !(await getRepo().deleteMap(id))) return jsonError(404, 'not_found');
  return new NextResponse(null, { status: 204 });
}
