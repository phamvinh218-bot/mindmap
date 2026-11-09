import type { MapRow, Repo, ShareRow } from './repo';

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function createMemoryRepo(): Repo {
  const maps = new Map<string, MapRow>();
  const shares = new Map<string, ShareRow>();
  let attempts: { id: number; key: string; at: number }[] = [];
  let attemptSeq = 0;
  // Strictly increasing timestamps so "newest first" ordering is deterministic.
  let lastTs = 0;
  const now = () => {
    lastTs = Math.max(Date.now(), lastTs + 1);
    return new Date(lastTs).toISOString();
  };

  return {
    async listMaps() {
      return [...maps.values()]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map(({ id, title, updated_at }) => ({ id, title, updated_at }));
    },
    async getMap(id) {
      const m = maps.get(id);
      return m ? clone(m) : null;
    },
    async createMap(title, data) {
      const ts = now();
      const row: MapRow = { id: crypto.randomUUID(), title, data: clone(data), version: 1, created_at: ts, updated_at: ts };
      maps.set(row.id, row);
      return clone(row);
    },
    async renameMap(id, title) {
      const m = maps.get(id);
      if (!m) return false;
      m.title = title;
      m.updated_at = now();
      return true;
    },
    async deleteMap(id) {
      for (const s of [...shares.values()]) if (s.map_id === id) shares.delete(s.id);
      return maps.delete(id);
    },
    async saveMapData(id, data, expectedVersion) {
      const m = maps.get(id);
      if (!m) return { ok: false, reason: 'not_found' };
      if (m.version !== expectedVersion) return { ok: false, reason: 'conflict', version: m.version };
      m.data = clone(data);
      m.version += 1;
      m.updated_at = now();
      return { ok: true, version: m.version };
    },
    async listShares(mapId) {
      return [...shares.values()].filter((s) => s.map_id === mapId).map(clone);
    },
    async getShareByToken(token) {
      for (const s of shares.values()) if (s.token === token) return clone(s);
      return null;
    },
    async getShare(id) {
      const s = shares.get(id);
      return s ? clone(s) : null;
    },
    async createShare(row) {
      const s: ShareRow = { ...row, id: crypto.randomUUID(), enabled: true, session_version: 1, created_at: now(), last_used_at: null };
      shares.set(s.id, s);
      return clone(s);
    },
    async updateShare(id, patch) {
      const s = shares.get(id);
      if (!s) return null;
      Object.assign(s, patch);
      return clone(s);
    },
    async deleteShare(id) {
      return shares.delete(id);
    },
    async countRecentFailures(key, sinceIso, upToId) {
      const since = Date.parse(sinceIso);
      return attempts.filter((a) => a.key === key && a.at >= since && (upToId === undefined || a.id <= upToId)).length;
    },
    async recordFailure(key) {
      const id = ++attemptSeq;
      attempts.push({ id, key, at: Date.now() });
      return id;
    },
    async clearAttempts(key) {
      attempts = attempts.filter((a) => a.key !== key);
    },
    async purgeAttemptsBefore(iso) {
      const t = Date.parse(iso);
      attempts = attempts.filter((a) => a.at >= t);
    },
    async ping() {},
  };
}
