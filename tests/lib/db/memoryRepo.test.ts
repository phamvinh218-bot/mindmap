import { describe, it, expect } from 'vitest';
import { createMemoryRepo } from '@/lib/db/memoryRepo';
import { newMapData } from '@/lib/db/repo';

describe('memory repo', () => {
  it('saves with the expected version and bumps it', async () => {
    const repo = createMemoryRepo();
    const m = await repo.createMap('A', newMapData('A'));
    expect(m.version).toBe(1);
    const r = await repo.saveMapData(m.id, newMapData('B'), 1);
    expect(r).toEqual({ ok: true, version: 2 });
    expect((await repo.getMap(m.id))!.data.nodes[0].text).toBe('B');
  });

  it('reports a conflict with the current version on a stale save', async () => {
    const repo = createMemoryRepo();
    const m = await repo.createMap('A', newMapData('A'));
    await repo.saveMapData(m.id, newMapData('B'), 1);
    const r = await repo.saveMapData(m.id, newMapData('C'), 1);
    expect(r).toEqual({ ok: false, reason: 'conflict', version: 2 });
  });

  it('reports not_found for an unknown map', async () => {
    const repo = createMemoryRepo();
    expect(await repo.saveMapData('nope', newMapData('x'), 1)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('deleting a map removes its shares', async () => {
    const repo = createMemoryRepo();
    const m = await repo.createMap('A', newMapData('A'));
    const s = await repo.createShare({ map_id: m.id, token: 't1', label: null, permission: 'view', password_hash: 'h' });
    await repo.deleteMap(m.id);
    expect(await repo.getShare(s.id)).toBeNull();
    expect(await repo.getShareByToken('t1')).toBeNull();
  });

  it('counts failures only since the given time', async () => {
    const repo = createMemoryRepo();
    await repo.recordFailure('k');
    const since = new Date(Date.now() + 1000).toISOString();
    expect(await repo.countRecentFailures('k', new Date(0).toISOString())).toBe(1);
    expect(await repo.countRecentFailures('k', since)).toBe(0);
  });
});
