import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getRepo } from '@/lib/db';
import { isUuid } from '@/lib/api';
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/auth/session';
import { OwnerEditor } from './OwnerEditor';

export default async function MapPage({ params, searchParams }: PageProps<'/m/[id]'>) {
  const jar = await cookies();
  if (!(await verifyOwnerSession(jar.get(OWNER_COOKIE)?.value))) redirect('/login');
  const { id } = await params;
  const sp = await searchParams;
  const repo = getRepo();
  const map = isUuid(id) ? await repo.getMap(id) : null;
  if (!map) notFound();
  const maps = (await repo.listMaps()).map(({ id, title }) => ({ id, title }));
  return (
    <OwnerEditor
      key={map.id}
      map={{ id: map.id, title: map.title, data: map.data, version: map.version }}
      maps={maps}
      openShare={sp.share === '1'}
    />
  );
}
