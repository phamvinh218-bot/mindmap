/** Lowercase and strip Vietnamese diacritics (đ → d) for forgiving search. */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function relativeTimeVi(iso: string, now: Date = new Date()): string {
  const diff = (Date.parse(iso) - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'vừa xong';
  const fmt = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  for (const [unit, sec] of UNITS) {
    // use weeks only between 2 and 4 weeks, otherwise days read more naturally
    if (unit === 'week' && abs < 14 * 24 * 3600) continue;
    if (abs >= sec) return fmt.format(Math.round(diff / sec), unit);
  }
  return 'vừa xong';
}
