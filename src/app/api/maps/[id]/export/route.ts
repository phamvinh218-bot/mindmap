import type { NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { isUuid, slug } from '@/lib/api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  const map = isUuid(id) ? await getRepo().getMap(id) : null;
  if (!map) return jsonError(404, 'not_found');
  return new Response(JSON.stringify({ title: map.title, data: map.data }, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${slug(map.title)}.json"`,
    },
  });
}
