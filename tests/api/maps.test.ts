import { describe, it, expect, beforeEach } from 'vitest';
import * as list from '@/app/api/maps/route';
import * as one from '@/app/api/maps/[id]/route';
import * as dataRoute from '@/app/api/maps/[id]/data/route';
import * as versionRoute from '@/app/api/maps/[id]/version/route';
import * as dup from '@/app/api/maps/[id]/duplicate/route';
import * as exp from '@/app/api/maps/[id]/export/route';
import * as imp from '@/app/api/maps/import/route';
import { newMapData } from '@/lib/db/repo';
import type { Repo } from '@/lib/db/repo';
import { freshRepo, req, ownerCookies, ctx } from '../helpers';

let repo: Repo;
let cookies: Record<string, string>;
beforeEach(async () => {
  repo = freshRepo();
  cookies = await ownerCookies();
});

async function create(title = 'Dự án A'): Promise<string> {
  const res = await list.POST(req('/api/maps', { method: 'POST', body: { title }, cookies }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

describe('maps API', () => {
  it('every route is 401 without the owner cookie', async () => {
    const id = await create();
    const p = ctx({ id });
    const statuses = await Promise.all([
      list.GET(req('/api/maps')),
      list.POST(req('/api/maps', { method: 'POST', body: { title: 'x' } })),
      one.GET(req(`/api/maps/${id}`), p),
      one.PATCH(req(`/api/maps/${id}`, { method: 'PATCH', body: { title: 'x' } }), p),
      one.DELETE(req(`/api/maps/${id}`, { method: 'DELETE' }), p),
      dataRoute.PUT(req(`/api/maps/${id}/data`, { method: 'PUT', body: { data: newMapData('x'), version: 1 } }), p),
      versionRoute.GET(req(`/api/maps/${id}/version`), p),
      dup.POST(req(`/api/maps/${id}/duplicate`, { method: 'POST' }), p),
      exp.GET(req(`/api/maps/${id}/export`), p),
      imp.POST(req('/api/maps/import', { method: 'POST', body: { title: 'x', data: newMapData('x') } })),
    ]);
    expect(statuses.map((r) => r.status)).toEqual(Array(10).fill(401));
  });

  it('creates a map whose root text is the title, and lists it', async () => {
    const id = await create('Dự án A');
    const got = await (await one.GET(req(`/api/maps/${id}`, { cookies }), ctx({ id }))).json();
    expect(got).toMatchObject({ id, title: 'Dự án A', version: 1 });
    expect(got.data.nodes[0].text).toBe('Dự án A');
    const all = await (await list.GET(req('/api/maps', { cookies }))).json();
    expect(all).toEqual([{ id, title: 'Dự án A', updated_at: expect.any(String) }]);
  });

  it('rejects an empty title', async () => {
    const res = await list.POST(req('/api/maps', { method: 'POST', body: { title: '  ' }, cookies }));
    expect(res.status).toBe(400);
  });

  it('renames and deletes', async () => {
    const id = await create();
    expect((await one.PATCH(req(`/api/maps/${id}`, { method: 'PATCH', body: { title: 'Mới' }, cookies }), ctx({ id }))).status).toBe(204);
    expect((await repo.getMap(id))!.title).toBe('Mới');
    expect((await one.DELETE(req(`/api/maps/${id}`, { method: 'DELETE', cookies }), ctx({ id }))).status).toBe(204);
    expect((await one.GET(req(`/api/maps/${id}`, { cookies }), ctx({ id }))).status).toBe(404);
  });

  it('saves with version check: 200, then 409 with the current version on a stale save', async () => {
    const id = await create();
    const put = (version: number, data: unknown = newMapData('B')) =>
      dataRoute.PUT(req(`/api/maps/${id}/data`, { method: 'PUT', body: { data, version }, cookies }), ctx({ id }));
    const ok = await put(1);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ version: 2 });
    const stale = await put(1);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'conflict', version: 2 });
    const v = await (await versionRoute.GET(req(`/api/maps/${id}/version`, { cookies }), ctx({ id }))).json();
    expect(v).toEqual({ version: 2 });
  });

  it('rejects invalid data with 400 and oversize data with 413', async () => {
    const id = await create();
    const put = (data: unknown) =>
      dataRoute.PUT(req(`/api/maps/${id}/data`, { method: 'PUT', body: { data, version: 1 }, cookies }), ctx({ id }));
    expect((await put({ nodes: [], edges: [] })).status).toBe(400);
    const big = newMapData('x'.repeat(2 * 1024 * 1024 + 1));
    expect((await put(big)).status).toBe(413);
  });

  it('save on a missing map is 404', async () => {
    const res = await dataRoute.PUT(
      req('/api/maps/nope/data', { method: 'PUT', body: { data: newMapData('x'), version: 1 }, cookies }),
      ctx({ id: 'nope' }),
    );
    expect(res.status).toBe(404);
  });

  it('duplicate gets a " (bản sao)" title and the same data', async () => {
    const id = await create('Dự án A');
    const res = await dup.POST(req(`/api/maps/${id}/duplicate`, { method: 'POST', cookies }), ctx({ id }));
    const { id: copyId } = await res.json();
    const copy = (await repo.getMap(copyId))!;
    expect(copy.title).toBe('Dự án A (bản sao)');
    expect(copy.data).toEqual((await repo.getMap(id))!.data);
  });

  it('import then export round-trips the data', async () => {
    const data = newMapData('Gốc nhập');
    const res = await imp.POST(req('/api/maps/import', { method: 'POST', body: { title: 'Nhập', data }, cookies }));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const ex = await exp.GET(req(`/api/maps/${id}/export`, { cookies }), ctx({ id }));
    expect(ex.headers.get('content-disposition')).toMatch(/attachment; filename=".+\.json"/);
    expect(await ex.json()).toEqual({ title: 'Nhập', data });
  });

  it('import rejects invalid data', async () => {
    const res = await imp.POST(req('/api/maps/import', { method: 'POST', body: { title: 'x', data: { nodes: 1 } }, cookies }));
    expect(res.status).toBe(400);
  });
});
