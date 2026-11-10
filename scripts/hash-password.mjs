// Prints a bcrypt hash for OWNER_PASSWORD_HASH. The password is read without echoing.
// With --write-env it writes .env.local for local use instead (keeping other values,
// creating SESSION_SECRET / CRON_SECRET when missing).
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function writeEnvLocal(encodedHash) {
  const file = '.env.local';
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const env = new Map();
  for (const l of lines) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l);
    if (m) env.set(m[1], m[2]);
  }
  env.set('OWNER_PASSWORD_HASH', encodedHash);
  if (!env.get('SESSION_SECRET')) env.set('SESSION_SECRET', randomBytes(36).toString('base64url'));
  if (!env.get('CRON_SECRET')) env.set('CRON_SECRET', randomBytes(24).toString('base64url'));
  if (!env.has('SUPABASE_URL')) env.set('SUPABASE_URL', '');
  if (!env.has('SUPABASE_SERVICE_ROLE_KEY')) env.set('SUPABASE_SERVICE_ROLE_KEY', '');
  const out = ['# Local settings (not committed). Empty SUPABASE_URL = in-memory store, data lost on restart.'];
  for (const [k, v] of env) out.push(`${k}=${v}`);
  writeFileSync(file, out.join('\n') + '\n');
}

function readHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    if (!stdin.isTTY) {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (c) => (buf += c));
      stdin.on('end', () => resolve(buf.replace(/\r?\n$/, '')));
      return;
    }
    let pw = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(pw);
      } else if (ch === '\u0003') {
        process.exit(130);
      } else if (ch === '\u007f' || ch === '\b') {
        pw = pw.slice(0, -1);
      } else {
        pw += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const pw = await readHidden('Mật khẩu mới: ');
if (pw.length < 8) {
  console.error('Mật khẩu cần ít nhất 8 ký tự.');
  process.exit(1);
}
const again = process.stdin.isTTY ? await readHidden('Nhập lại: ') : pw;
if (again !== pw) {
  console.error('Hai lần nhập không khớp.');
  process.exit(1);
}
const hash = await bcrypt.hash(pw, 10);
// Encoded without "$" so env loaders cannot mangle it (see src/lib/auth/password.ts).
const encoded = 'b64:' + Buffer.from(hash, 'utf8').toString('base64url');
if (process.argv.includes('--write-env')) {
  writeEnvLocal(encoded);
  console.log('\nĐã lưu mật khẩu vào .env.local. Chạy "npm run dev" rồi mở http://localhost:3000');
} else {
  console.log('\nDán nguyên giá trị sau vào biến môi trường OWNER_PASSWORD_HASH:\n');
  console.log(encoded);
}
