import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '@/app/api/cron/daily/route';
import { freshRepo, req } from '../helpers';

afterEach(() => vi.useRealTimers());

describe('daily cron', () => {
  it('rejects calls without the cron secret', async () => {
    freshRepo();
    expect((await GET(req('/api/cron/daily'))).status).toBe(401);
    expect((await GET(req('/api/cron/daily', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
  });

  it('pings the database and purges login attempts older than a day', async () => {
    const repo = freshRepo();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await repo.recordFailure('old');
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    await repo.recordFailure('new');
    const ping = vi.spyOn(repo, 'ping');
    const res = await GET(req('/api/cron/daily', { headers: { authorization: 'Bearer cron-test' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(ping).toHaveBeenCalled();
    expect(await repo.countRecentFailures('old', new Date(0).toISOString())).toBe(0);
    expect(await repo.countRecentFailures('new', new Date(0).toISOString())).toBe(1);
  });
});
