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
