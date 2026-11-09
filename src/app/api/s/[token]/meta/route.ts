import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError } from '@/lib/auth/guards';
import { isShareToken } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const repo = getRepo();
  const share = isShareToken(token) ? await repo.getShareByToken(token) : null;
  if (!share || !share.enabled) return jsonError(404, 'not_found');
  const map = await repo.getMap(share.map_id);
  if (!map) return jsonError(404, 'not_found');
  return NextResponse.json({ title: map.title });
}
