import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRepo } from '@/lib/db';
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/auth/session';
import { Dashboard } from './_dashboard/Dashboard';

export default async function Home() {
  const jar = await cookies();
  if (!(await verifyOwnerSession(jar.get(OWNER_COOKIE)?.value))) redirect('/login');
  const maps = await getRepo().listMaps();
  return <Dashboard initialMaps={maps} />;
}
