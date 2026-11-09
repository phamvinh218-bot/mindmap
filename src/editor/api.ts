import type { MapData } from '@/lib/types';

/** status 0 = network failure. */
export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; status: 409; version: number }
  | { ok: false; status: 401 | 403 | 404 | 413 | 400 | 500 | 0 };

export interface EditorApi {
  save(data: MapData, version: number): Promise<SaveResult>;
  getVersion(): Promise<number>;
  load(): Promise<{ data: MapData; version: number }>;
}

async function put(url: string, data: MapData, version: number): Promise<SaveResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data, version }),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  const body = (await res.json().catch(() => ({}))) as { version?: number };
  if (res.ok && typeof body.version === 'number') return { ok: true, version: body.version };
  if (res.status === 409 && typeof body.version === 'number') return { ok: false, status: 409, version: body.version };
  const known = [401, 403, 404, 413, 400] as const;
  const status = (known as readonly number[]).includes(res.status) ? (res.status as (typeof known)[number]) : 500;
  return { ok: false, status };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return (await res.json()) as T;
}

export function ownerApi(mapId: string): EditorApi {
  const base = `/api/maps/${mapId}`;
  return {
    save: (data, version) => put(`${base}/data`, data, version),
    getVersion: async () => (await getJson<{ version: number }>(`${base}/version`)).version,
    load: async () => {
      const m = await getJson<{ data: MapData; version: number }>(base);
      return { data: m.data, version: m.version };
    },
  };
}

export function shareApi(token: string): EditorApi {
  const base = `/api/s/${encodeURIComponent(token)}`;
  return {
    save: (data, version) => put(`${base}/map`, data, version),
    getVersion: async () => (await getJson<{ version: number }>(`${base}/version`)).version,
    load: async () => {
      const m = await getJson<{ data: MapData; version: number }>(`${base}/map`);
      return { data: m.data, version: m.version };
    },
  };
}
