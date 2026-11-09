import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { newMapData } from '@/lib/db/repo';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { parseTitle, readJson } from '@/lib/api';

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  return NextResponse.json(await getRepo().listMaps());
}

export async function POST(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const title = parseTitle((await readJson(req))?.title);
  if (!title) return jsonError(400, 'invalid_title');
  const map = await getRepo().createMap(title, newMapData(title));
  return NextResponse.json({ id: map.id });
}
