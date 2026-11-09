import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireOwner } from '@/lib/auth/guards';
import { isUuid } from '@/lib/api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { id } = await params;
  const map = isUuid(id) ? await getRepo().getMap(id) : null;
  if (!map) return jsonError(404, 'not_found');
  return NextResponse.json({ version: map.version });
}
