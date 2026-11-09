import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MapRow, Repo, ShareRow } from './repo';

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`supabase: ${res.error.message}`);
  return res.data;
}

export function createSupabaseRepo(url: string, serviceKey: string): Repo {
  const db: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async listMaps() {
      return must(await db.from('maps').select('id,title,updated_at').order('updated_at', { ascending: false })) ?? [];
    },
    async getMap(id) {
      return must(await db.from('maps').select('*').eq('id', id).maybeSingle()) as MapRow | null;
    },
    async createMap(title, data) {
      return must(await db.from('maps').insert({ title, data }).select('*').single()) as MapRow;
    },
    async renameMap(id, title) {
      const rows = must(
        await db.from('maps').update({ title, updated_at: new Date().toISOString() }).eq('id', id).select('id'),
      );
      return (rows ?? []).length > 0;
    },
    async deleteMap(id) {
      const rows = must(await db.from('maps').delete().eq('id', id).select('id'));
      return (rows ?? []).length > 0;
    },
    async saveMapData(id, data, expectedVersion) {
      const rows = must(
        await db.rpc('save_map_data', { p_id: id, p_data: data, p_expected: expectedVersion }),
      ) as { ok: boolean; version: number | null }[];
      const r = rows[0];
      if (r?.ok) return { ok: true, version: r.version as number };
      if (r?.version == null) return { ok: false, reason: 'not_found' };
      return { ok: false, reason: 'conflict', version: r.version };
    },
    async listShares(mapId) {
      return must(
        await db.from('shares').select('*').eq('map_id', mapId).order('created_at', { ascending: true }),
      ) as ShareRow[];
    },
    async getShareByToken(token) {
      return must(await db.from('shares').select('*').eq('token', token).maybeSingle()) as ShareRow | null;
    },
    async getShare(id) {
      return must(await db.from('shares').select('*').eq('id', id).maybeSingle()) as ShareRow | null;
    },
    async createShare(row) {
      return must(await db.from('shares').insert(row).select('*').single()) as ShareRow;
    },
    async updateShare(id, patch) {
      return must(await db.from('shares').update(patch).eq('id', id).select('*').maybeSingle()) as ShareRow | null;
    },
    async deleteShare(id) {
      const rows = must(await db.from('shares').delete().eq('id', id).select('id'));
      return (rows ?? []).length > 0;
    },
    async countRecentFailures(key, sinceIso, upToId) {
      let q = db
        .from('login_attempts')
        .select('key', { count: 'exact', head: true })
        .eq('key', key)
        .gte('attempted_at', sinceIso);
      if (upToId !== undefined) q = q.lte('id', upToId);
      const res = await q;
      if (res.error) throw new Error(`supabase: ${res.error.message}`);
      return res.count ?? 0;
    },
    async recordFailure(key) {
      const row = must(await db.from('login_attempts').insert({ key }).select('id').single()) as { id: number };
      return Number(row.id);
    },
    async clearAttempts(key) {
      must(await db.from('login_attempts').delete().eq('key', key));
    },
    async purgeAttemptsBefore(iso) {
      must(await db.from('login_attempts').delete().lt('attempted_at', iso));
    },
    async ping() {
      must(await db.from('maps').select('id').limit(1));
    },
  };
}
