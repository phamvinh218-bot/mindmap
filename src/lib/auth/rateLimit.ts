import type { Repo } from '../db/repo';

export const RATE = { max: 5, windowMs: 15 * 60_000 };

export async function isBlocked(repo: Repo, key: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - RATE.windowMs).toISOString();
  return (await repo.countRecentFailures(key, since)) >= RATE.max;
}

export async function recordFailure(repo: Repo, key: string): Promise<void> {
  await repo.recordFailure(key);
}

/**
 * Records this attempt first, then counts attempts up to and including it, so parallel
 * requests cannot all slip past the check. Returns true when the attempt may proceed.
 */
export async function attempt(repo: Repo, key: string, max: number = RATE.max, now: Date = new Date()): Promise<boolean> {
  const id = await repo.recordFailure(key);
  const since = new Date(now.getTime() - RATE.windowMs).toISOString();
  return (await repo.countRecentFailures(key, since, id)) <= max;
}

/** After a successful login, earlier failures for this key no longer count. */
export function clearAttempts(repo: Repo, key: string): Promise<void> {
  return repo.clearAttempts(key);
}

/** Cap on owner login attempts from all IPs together. */
export const OWNER_GLOBAL = { key: 'owner:*', max: 50 };
