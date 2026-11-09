import type { NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { isUuid, readJson, saveMap } from '@/lib/api';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, 'not_found');
  return saveMap(getRepo(), id, await readJson(req));
}
