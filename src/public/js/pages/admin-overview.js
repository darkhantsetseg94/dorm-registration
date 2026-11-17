/**
 * Ажилтны хянах самбар: гол үзүүлэлт, байрны дүүргэлт, өдөр тутмын хүсэлт.
 */
import { h, $, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api, qs } from '../core/api.js';
import { initPage } from '../core/layout.js';
import { meter, loadingBlock, errorBlock, options } from '../core/ui.js';
import { timeAgo, yearLabel } from '../core/format.js';

const { meta } = await initPage({ role: 'staff', active: 'overview', title: 'Хянах самбар' });
const yearSelect = $('#year');
let year = new URLSearchParams(window.location.search).get('year') || meta.window.academicYear;

function stat({ label, value, sub, href, dot }) {
  const children = [
    h('div', { class: 'stat-label' }, dot ? h('i', { class: dot }) : null, label),
    h('div', { class: 'stat-value' }, value),
    sub ? h('div', { class: 'stat-sub' }, sub) : null,
  ];
  return href ? h('a', { class: 'stat', href }, children) : h('div', { class: 'stat' }, children);
}

function renderStats(s) {
  const link = (extra) => `/admin/applications.html${qs({ year: s.year, ...extra })}`;
  render($('#stats'),
    stat({ label: 'Нийт хүсэлт', value: s.total, sub: s.status.CANCELLED ? `${s.status.CANCELLED} цуцалсан` : 'цуцалснаас бусад', href: link({}) }),
    stat({ label: 'Хүлээгдэж буй', value: s.status.PENDING, sub: 'шийдвэр хүлээж буй', href: link({ status: 'PENDING', sort: 'oldest' }), dot: 'dot-wait' }),
    stat({ label: 'Зөвшөөрсөн', value: s.status.APPROVED, href: link({ status: 'APPROVED' }), dot: 'dot-ok' }),
    stat({ label: 'Татгалзсан', value: s.status.REJECTED, href: link({ status: 'REJECTED' }), dot: 'dot-bad' }),
    stat({ label: 'Сул ор', value: s.freeBeds, sub: `${s.capacity} орноос` }),
    stat({ label: 'Өрөөгүй оюутан', value: s.unassigned, sub: 'зөвшөөрсөн ч өрөө аваагүй', href: '/admin/dorms.html' }));
}

function renderOccupancy(dorms) {
  if (dorms.length === 0) {
    render($('#occupancy'), h('p', { class: 'muted' }, 'Байр бүртгэгдээгүй байна. ', h('a', { href: '/admin/dorms.html' }, 'Байр нэмэх')));
    return;
  }
  render($('#occupancy'), h('div', { class: 'occ-list' }, dorms.map((d) => h('div', {},
    h('div', { class: 'occ-row-head' },
      h('strong', {}, d.name, ' ', h('span', { class: 'chip' }, d.genderLabel), d.isActive ? null : h('span', { class: 'chip' }, 'Хүсэлт авахгүй')),
      h('span', { class: 'num' }, `${d.approved} / ${d.capacity} ор`)),
    meter(d.capacity, d.approved, d.pending, true),
    h('div', { class: 'hint mt-8' },
      `${d.pending} хүсэлт хүлээгдэж буй, ${d.available} сул ор`,
      d.unassigned ? `, ${d.unassigned} оюутан өрөөгүй` : '')))));
}

/** 14 хоногийн баганан график (SVG) — багана бүр дээр hover/focus-оор утга харагдана */
function renderDaily(days) {
  const W = 640;
  const H = 200;
  const pad = { top: 22, right: 8, bottom: 26, left: 28 };
  const max = Math.max(4, ...days.map((d) => d.count));
  const niceMax = Math.ceil(max / 2) * 2;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / days.length;
  const barW = Math.min(26, slot - 8);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, text = null) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== null) node.textContent = text;
    return node;
  };

  const total = days.reduce((sum, d) => sum + d.count, 0);
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
    'aria-label': `Сүүлийн 14 хоногт нийт ${total} хүсэлт ирсэн`,
  });

  // Хэвтээ туслах шугам (3 ширхэг)
  [0, niceMax / 2, niceMax].forEach((v) => {
    const y = pad.top + innerH - (v / niceMax) * innerH;
    svg.append(el('line', { x1: pad.left, x2: W - pad.right, y1: y, y2: y, class: 'grid' }));
    svg.append(el('text', { x: pad.left - 8, y: y + 4, 'text-anchor': 'end' }, String(v)));
  });

  days.forEach((d, i) => {
    const x = pad.left + i * slot + (slot - barW) / 2;
    const bh = (d.count / niceMax) * innerH;
    const y = pad.top + innerH - bh;
    const [, m, day] = d.date.split('-');
    const g = el('g', { class: 'col', tabindex: '0', role: 'img', 'aria-label': `${m}-р сарын ${Number(day)}: ${d.count} хүсэлт` });
    g.append(el('title', {}, `${m}.${day}: ${d.count} хүсэлт`));
    g.append(el('rect', { class: 'hit', x: pad.left + i * slot, y: pad.top, width: slot, height: innerH }));
    if (d.count > 0) {
      // Дээд талдаа 4px бөөрөнхий, доод тал нь суурь шугам дээр
      const r = Math.min(4, bh);
      g.append(el('path', {
        class: 'bar',
        d: `M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + bh} Z`,
      }));
      g.append(el('text', { x: x + barW / 2, y: y - 6, 'text-anchor': 'middle', class: 'val' }, String(d.count)));
    }
    // Тэгш өдрийн шошго (давхцахаас сэргийлнэ)
    if (i % 2 === 1 || i === days.length - 1) {
      svg.append(el('text', { x: x + barW / 2, y: H - 8, 'text-anchor': 'middle' }, i === days.length - 1 ? 'Өнөөдөр' : `${m}.${day}`));
    }
    svg.append(g);
  });
  svg.append(el('line', { x1: pad.left, x2: W - pad.right, y1: pad.top + innerH, y2: pad.top + innerH, class: 'grid' }));
  render($('#daily'), svg);
}

function hbars(items, emptyText) {
  if (items.length === 0 || items.every((i) => i.n === 0)) return h('p', { class: 'muted small' }, emptyText);
  const max = Math.max(...items.map((i) => i.n), 1);
  return h('div', { class: 'hbars' }, items.filter((i) => i.n > 0).map((i) => {
    const fill = h('div', { class: 'hbar-fill' });
    fill.style.width = `${(i.n / max) * 100}%`;
    return h('div', { class: 'hbar' },
      h('span', { class: 'name', title: i.label }, i.label),
      h('div', { class: 'hbar-track' }, fill),
      h('span', { class: 'n' }, i.n));
  }));
}

async function renderPending() {
  const list = $('#pending');
  try {
    const data = await api.get(`/api/admin/applications${qs({ year, status: 'PENDING', sort: 'oldest', pageSize: 6 })}`);
    if (data.applications.length === 0) {
      render(list, h('li', { class: 'empty small' }, 'Шийдвэр хүлээж буй хүсэлт алга.'));
      return;
    }
    render(list, data.applications.map((a) => h('li', {}, h('a', { href: `/admin/applications.html?id=${a.id}&status=PENDING` },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, a.student.name.slice(0, 1)),
      h('div', { class: 'grow' }, h('strong', {}, a.student.name), h('span', {}, `${a.dormName}, ${timeAgo(a.createdAt)}`)),
      a.priorityTags.length ? h('span', { class: 'chip chip-brass', title: a.priorityLabels.join(', ') }, `${a.priorityTags.length} давуу эрх`) : null,
      icon('chevronRight', 'icon-sm')))));
  } catch (err) {
    render(list, h('li', { class: 'empty small' }, err.message));
  }
}

async function load() {
  render($('#occupancy'), loadingBlock());
  try {
    const s = await api.get(`/api/admin/stats${qs({ year })}`);
    render(yearSelect, options(s.years.map((y) => [y, `${yearLabel(y)} хичээлийн жил`]), year));
    $('#subtitle').textContent = `${yearLabel(year)} хичээлийн жилийн тойм`;
    renderStats(s);
    renderOccupancy(s.dorms);
    renderDaily(s.daily);
    render($('#provinces'), hbars(s.provinces.map((p) => ({ label: p.name, n: p.n })), 'Аймгийн мэдээлэл оруулсан хүсэлт алга.'));
    render($('#tags'), hbars(s.tags.map((t) => ({ label: t.label, n: t.n })), 'Давуу эрх сонгосон хүсэлт алга.'));
    renderPending();
  } catch (err) {
    render($('#occupancy'), errorBlock(err.message, load));
  }
}

yearSelect.addEventListener('change', () => {
  year = yearSelect.value;
  window.history.replaceState(null, '', `?year=${year}`);
  load();
});

load();
