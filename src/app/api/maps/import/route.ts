import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { parseTitle, readJson } from '@/lib/api';
import { validateMapData } from '@/lib/schema';

export async function POST(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const body = await readJson(req);
  const title = parseTitle(body?.title);
  if (!title) return jsonError(400, 'invalid_title');
  const v = validateMapData(body?.data);
  if (!v.ok) return jsonError(v.error === 'too_large' ? 413 : 400, v.error);
  const map = await getRepo().createMap(title, v.data);
  return NextResponse.json({ id: map.id });
}
