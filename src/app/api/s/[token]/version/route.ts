import { NextResponse, type NextRequest } from 'next/server';
import { getRepo } from '@/lib/db';
import { jsonError, requireShare } from '@/lib/auth/guards';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auth = await requireShare(req, token);
  if ('response' in auth) return auth.response;
  const map = await getRepo().getMap(auth.share.map_id);
  if (!map) return jsonError(404, 'not_found');
  return NextResponse.json({ version: map.version });
}
