// Prints a bcrypt hash for OWNER_PASSWORD_HASH. The password is read without echoing.
import bcrypt from 'bcryptjs';

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
console.log('\nDán giá trị sau vào biến môi trường OWNER_PASSWORD_HASH:\n');
console.log(await bcrypt.hash(pw, 10));
