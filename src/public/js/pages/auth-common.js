/**
 * Нэвтрэх, бүртгүүлэх хуудасны дундын хэсэг:
 * шөнийн байрны фасад (гэрэлтэй цонхнууд) болон нууц үг харуулах товч.
 */
import { h, $ } from '../core/dom.js';
import { icon } from '../core/icons.js';

const COLS = 9;
const ROWS = 7;
// Тогтмол хэв маяг — хуудас бүрт ижил харагдана (санамсаргүй биш)
const LIT = new Set([1, 4, 5, 9, 12, 16, 20, 21, 25, 29, 31, 33, 36, 40, 41, 44, 48, 50, 52, 55, 57]);

export function drawBuilding() {
  const building = $('#building');
  if (!building) return;
  building.style.setProperty('--cols', COLS);
  const windows = [];
  for (let i = 0; i < COLS * ROWS; i += 1) {
    const w = h('span', { class: `window${LIT.has(i) ? ' is-lit' : ''}` });
    if (LIT.has(i)) w.style.setProperty('--d', `${0.25 + (windows.filter((x) => x.classList.contains('is-lit')).length * 0.07)}s`);
    windows.push(w);
  }
  // Доод давхарт хаалга
  const lastRow = windows.splice((ROWS - 1) * COLS, COLS);
  building.append(...windows, ...lastRow.slice(0, 3), h('span', { class: 'window door' }), ...lastRow.slice(6));
  building.classList.add('is-animating');
}

/** Нууц үгийн талбарт "харуулах/нуух" товч */
export function passwordToggle(button, input) {
  const paint = () => {
    const shown = input.type === 'text';
    button.replaceChildren(icon(shown ? 'eyeOff' : 'eye'));
    button.setAttribute('aria-label', shown ? 'Нууц үгийг нуух' : 'Нууц үгийг харуулах');
    button.setAttribute('aria-pressed', String(shown));
  };
  button.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    paint();
    input.focus();
  });
  paint();
}

/** ?next= зөвхөн энэ сайтын хаяг байвал зөвшөөрнө (open redirect-ээс сэргийлнэ) */
export function safeNext(fallback) {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next;
  return fallback;
}
