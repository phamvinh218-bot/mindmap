import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getRepo } from '@/lib/db';
import { isShareToken } from '@/lib/api';
import { shareCookieName, verifyShareSession } from '@/lib/auth/session';
import { ShareGate } from './ShareGate';
import { PartnerEditor } from './PartnerEditor';

export const metadata: Metadata = { title: 'Mindmap được chia sẻ', robots: { index: false, follow: false } };

function Gone() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
      <div>
        <h1 className="text-lg font-semibold">Link không còn dùng được</h1>
        <p className="mt-1 text-sm text-muted">Link này không tồn tại hoặc đã bị chủ mindmap tắt.</p>
      </div>
    </main>
  );
}

export default async function SharePage({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params;
  const repo = getRepo();
  const share = isShareToken(token) ? await repo.getShareByToken(token) : null;
  if (!share || !share.enabled) return <Gone />;
  const map = await repo.getMap(share.map_id);
  if (!map) return <Gone />;

  const jar = await cookies();
  const session = await verifyShareSession(jar.get(shareCookieName(token))?.value);
  const valid = session && session.shareId === share.id && session.sv === share.session_version;
  if (!valid) return <ShareGate token={token} title={map.title} />;

  return (
    <PartnerEditor
      token={token}
      map={{ title: map.title, data: map.data, version: map.version }}
      mode={share.permission === 'edit' ? 'edit' : 'view'}
    />
  );
}
