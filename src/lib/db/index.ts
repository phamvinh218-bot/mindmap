import { createMemoryRepo } from './memoryRepo';
import { createSupabaseRepo } from './supabaseRepo';
import type { Repo } from './repo';

const g = globalThis as unknown as { __mindmapRepo?: Repo };

/**
 * Supabase when SUPABASE_URL is set; otherwise a process-wide in-memory repo
 * (local development and tests only — data is lost on restart).
 */
export function getRepo(): Repo {
  if (!g.__mindmapRepo) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      g.__mindmapRepo = createSupabaseRepo(url, key);
    } else {
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MEMORY_REPO !== '1') {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production');
      }
      g.__mindmapRepo = createMemoryRepo();
    }
  }
  return g.__mindmapRepo;
}

/** Test hook: replace the repo used by route handlers. */
export function setRepo(repo: Repo | undefined): void {
  g.__mindmapRepo = repo;
}
