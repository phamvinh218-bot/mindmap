import bcrypt from 'bcryptjs';

const COST = 10;

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, COST);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pw, hash);
  } catch {
    return false;
  }
}

/**
 * bcrypt hashes contain "$", which env loaders (dotenv-expand in Next.js) treat as variable
 * references and mangle. The hash is therefore stored as "b64:" + base64url(hash).
 */
export function encodeOwnerHash(hash: string): string {
  return 'b64:' + Buffer.from(hash, 'utf8').toString('base64url');
}

export function ownerPasswordHash(): string {
  const raw = (process.env.OWNER_PASSWORD_HASH ?? '').trim();
  return raw.startsWith('b64:') ? Buffer.from(raw.slice(4), 'base64url').toString('utf8') : raw;
}
