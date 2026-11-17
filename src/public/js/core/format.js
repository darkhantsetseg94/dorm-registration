/**
 * Огноо, мөнгө, нэрийг харуулах формат.
 * SQLite datetime('now') нь UTC цаг ("2026-10-22 04:05:26") хадгалдаг тул
 * хэрэглэгчийн орон нутгийн цаг (Улаанбаатар, UTC+8) руу хөрвүүлнэ.
 */
const pad = (n) => String(n).padStart(2, '0');

export function parseUtc(text) {
  if (!text) return null;
  const date = new Date(`${String(text).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 2026.10.22 */
export function fmtDate(text) {
  const d = parseUtc(text);
  return d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : '';
}

/** 2026.10.22 13:05 */
export function fmtDateTime(text) {
  const d = parseUtc(text);
  return d ? `${fmtDate(text)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

/** "2026-11-30" (огноо талбар) → 2026.11.30 */
export function fmtPlainDate(text) {
  return text ? text.replaceAll('-', '.') : '';
}

/** Саяхан, 5 минутын өмнө, 3 цагийн өмнө, 2 өдрийн өмнө … */
export function timeAgo(text) {
  const d = parseUtc(text);
  if (!d) return '';
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return 'Саяхан';
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} өдрийн өмнө`;
  return fmtDate(text);
}

/** 85000 → 85,000₮ */
export function money(n) {
  return `${Number(n || 0).toLocaleString('en-US')}₮`;
}

/** "Бат-Эрдэнэ Ганбаатар" → "БГ" */
export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/** "Бат-Эрдэнэ Ганбаатар" → "Бат-Эрдэнэ" */
export function firstName(name = '') {
  return name.split(/\s+/)[0] || name;
}

/** "2026-2027" → "2026–2027" */
export function yearLabel(year) {
  return year ? year.replace('-', '–') : '';
}
