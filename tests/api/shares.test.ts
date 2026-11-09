import { describe, it, expect, beforeEach } from 'vitest';
import * as mapShares from '@/app/api/maps/[id]/shares/route';
import * as oneShare from '@/app/api/shares/[shareId]/route';
import * as meta from '@/app/api/s/[token]/meta/route';
import * as slogin from '@/app/api/s/[token]/login/route';
import * as smap from '@/app/api/s/[token]/map/route';
import * as sversion from '@/app/api/s/[token]/version/route';
import { newMapData, type Repo } from '@/lib/db/repo';
import { shareCookieName } from '@/lib/auth/session';
import { freshRepo, req, ownerCookies, ctx } from '../helpers';

let repo: Repo;
let owner: Record<string, string>;
let mapA: string;
let mapB: string;

beforeEach(async () => {
  repo = freshRepo();
  owner = await ownerCookies();
  mapA = (await repo.createMap('Bản đồ A', newMapData('A'))).id;
  mapB = (await repo.createMap('Bản đồ B', newMapData('B'))).id;
});

async function createShare(mapId: string, body: Record<string, unknown>) {
  const res = await mapShares.POST(req(`/api/maps/${mapId}/shares`, { method: 'POST', body, cookies: owner }), ctx({ id: mapId }));
  return { res, json: (await res.json()) as Record<string, unknown> };
}

async function loginAs(token: string, password: string, ip = '5.5.5.5') {
  const res = await slogin.POST(req(`/api/s/${token}/login`, { method: 'POST', body: { password }, ip }), ctx({ token }));
  const cookie = res.cookies.get(shareCookieName(token))?.value;
  return { res, cookies: cookie ? { [shareCookieName(token)]: cookie } : {} };
}

const tokenOf = (url: unknown) => String(url).split('/s/')[1];

describe('share management (owner)', () => {
  it('requires the owner', async () => {
    const res = await mapShares.GET(req(`/api/maps/${mapA}/shares`), ctx({ id: mapA }));
    expect(res.status).toBe(401);
  });

  it('rejects passwords shorter than 4 characters', async () => {
    const { res, json } = await createShare(mapA, { permission: 'view', password: '123' });
    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'password_short' });
  });

  it('creates a share and never exposes the password hash', async () => {
    const { res, json } = await createShare(mapA, { label: 'Partner Minh', permission: 'edit', password: 'bimat1' });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ label: 'Partner Minh', permission: 'edit', enabled: true });
    expect(String(json.url)).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);
    const list = await (await mapShares.GET(req(`/api/maps/${mapA}/shares`, { cookies: owner }), ctx({ id: mapA }))).text();
    expect(list).not.toContain('password_hash');
    expect(list).not.toContain('$2');
  });
});

describe('partner access', () => {
  it('meta shows the title for an enabled link and 404 otherwise', async () => {
    const { json } = await createShare(mapA, { permission: 'view', password: 'bimat1' });
    const token = tokenOf(json.url);
    expect(await (await meta.GET(req(`/api/s/${token}/meta`), ctx({ token }))).json()).toEqual({ title: 'Bản đồ A' });
    await oneShare.DELETE(req(`/api/shares/${json.id}`, { method: 'DELETE', cookies: owner }), ctx({ shareId: String(json.id) }));
    expect((await meta.GET(req(`/api/s/${token}/meta`), ctx({ token }))).status).toBe(404);
  });

  it('wrong password is 401, then 429 after 5 failures', async () => {
    const { json } = await createShare(mapA, { permission: 'view', password: 'bimat1' });
    const token = tokenOf(json.url);
    for (let i = 0; i < 5; i++) expect((await loginAs(token, 'sai')).res.status).toBe(401);
    expect((await loginAs(token, 'bimat1')).res.status).toBe(429);
  });

  it('a session reads only its own map, with a 7-day cookie', async () => {
    const { json } = await createShare(mapA, { permission: 'view', password: 'bimat1' });
    const token = tokenOf(json.url);
    const { res, cookies } = await loginAs(token, 'bimat1');
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=604800/);
    const got = await (await smap.GET(req(`/api/s/${token}/map`, { cookies }), ctx({ token }))).json();
    expect(got).toMatchObject({ title: 'Bản đồ A', permission: 'view', version: 1 });
    expect(got.data.nodes[0].text).toBe('A');
    expect((await repo.getShare(String(json.id)))!.last_used_at).not.toBeNull();
    // the cookie for A's token is useless for B's token
    const { json: jb } = await createShare(mapB, { permission: 'view', password: 'khac12' });
    const tokenB = tokenOf(jb.url);
    expect((await smap.GET(req(`/api/s/${tokenB}/map`, { cookies }), ctx({ token: tokenB }))).status).toBe(401);
  });

  it('view links cannot save; edit links can', async () => {
    const view = tokenOf((await createShare(mapA, { permission: 'view', password: 'bimat1' })).json.url);
    const edit = tokenOf((await createShare(mapA, { permission: 'edit', password: 'bimat2' })).json.url);
    const put = async (token: string, cookies: Record<string, string>) =>
      smap.PUT(req(`/api/s/${token}/map`, { method: 'PUT', body: { data: newMapData('Sửa'), version: 1 }, cookies }), ctx({ token }));
    const v = await loginAs(view, 'bimat1');
    const vr = await put(view, v.cookies);
    expect(vr.status).toBe(403);
    expect(await vr.json()).toEqual({ error: 'read_only' });
    const e = await loginAs(edit, 'bimat2');
    const er = await put(edit, e.cookies);
    expect(er.status).toBe(200);
    expect(await (await sversion.GET(req(`/api/s/${edit}/version`, { cookies: e.cookies }), ctx({ token: edit }))).json()).toEqual({ version: 2 });
  });

  it('changing the password or disabling the link ends existing sessions', async () => {
    const { json } = await createShare(mapA, { permission: 'view', password: 'bimat1' });
    const token = tokenOf(json.url);
    const id = String(json.id);
    const s1 = await loginAs(token, 'bimat1');
    const patch = (body: Record<string, unknown>) =>
      oneShare.PATCH(req(`/api/shares/${id}`, { method: 'PATCH', body, cookies: owner }), ctx({ shareId: id }));
    expect((await patch({ password: 'moi1234' })).status).toBe(200);
    expect((await smap.GET(req(`/api/s/${token}/map`, { cookies: s1.cookies }), ctx({ token }))).status).toBe(401);
    const s2 = await loginAs(token, 'moi1234');
    expect((await smap.GET(req(`/api/s/${token}/map`, { cookies: s2.cookies }), ctx({ token }))).status).toBe(200);
    await patch({ enabled: false });
    expect((await smap.GET(req(`/api/s/${token}/map`, { cookies: s2.cookies }), ctx({ token }))).status).toBe(401);
    expect((await loginAs(token, 'moi1234')).res.status).toBe(404);
  });

  it('switching edit → view applies to an open session immediately', async () => {
    const { json } = await createShare(mapA, { permission: 'edit', password: 'bimat1' });
    const token = tokenOf(json.url);
    const id = String(json.id);
    const s = await loginAs(token, 'bimat1');
    await oneShare.PATCH(req(`/api/shares/${id}`, { method: 'PATCH', body: { permission: 'view' }, cookies: owner }), ctx({ shareId: id }));
    const res = await smap.PUT(req(`/api/s/${token}/map`, { method: 'PUT', body: { data: newMapData('x'), version: 1 }, cookies: s.cookies }), ctx({ token }));
    expect(res.status).toBe(403);
  });
});
