import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { copyTitle, isUuid } from '@/lib/api';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  const repo = getRepo();
  const map = isUuid(id) ? await repo.getMap(id) : null;
  if (!map) return jsonError(404, 'not_found');
  const copy = await repo.createMap(copyTitle(map.title), map.data);
  return NextResponse.json({ id: copy.id });
}
