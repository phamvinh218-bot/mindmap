import type { Repo } from '../db/repo';

export const RATE = { max: 5, windowMs: 15 * 60_000 };

export async function isBlocked(repo: Repo, key: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - RATE.windowMs).toISOString();
  return (await repo.countRecentFailures(key, since)) >= RATE.max;
}

export function recordFailure(repo: Repo, key: string): Promise<void> {
  return repo.recordFailure(key);
}
