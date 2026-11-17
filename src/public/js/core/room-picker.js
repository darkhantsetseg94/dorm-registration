/**
 * Өрөө сонгогч: давхар бүрийг мөрөөр, өрөө бүрийг орны цэгтэйгээр харуулна.
 * Тохирохгүй өрөө (дүүрсэн, өөр хүйс) идэвхгүй, шалтгаан нь title-д.
 */
import { h } from './dom.js';
import { beds } from './ui.js';

/**
 * @param {object} o
 * @param {Array}  o.rooms         /api/admin/applications/:id/rooms → rooms
 * @param {number|null} o.selected  сонгогдсон өрөө
 * @param {number|null} o.suggested санал болгох өрөө
 * @param {boolean} o.allowNone     "Дараа хуваарилах" сонголт
 * @param {string} o.name           radio нэр
 */
export function roomPicker({ rooms, selected = null, suggested = null, allowNone = true, name = 'roomId' }) {
  let onlyFitting = true;
  const wrap = h('div', {});
  const body = h('div', { class: 'room-picker', role: 'radiogroup', 'aria-label': 'Өрөө сонгох' });
  const toggle = h('label', { class: 'confirm-line' },
    h('input', { type: 'checkbox', checked: true }),
    h('span', {}, 'Зөвхөн тохирох өрөөг харуулах'));

  function tile(room) {
    const disabled = !room.fits && !room.current;
    const label = room.problem && !room.current ? `${room.roomNumber}: ${room.problem}` : `${room.roomNumber} тоот, ${room.occupied}/${room.capacity} ор`;
    return h('label', {
      class: `room-tile${room.id === suggested ? ' is-suggested' : ''}`,
      title: label,
    },
    h('input', {
      type: 'radio', name, value: String(room.id), checked: room.id === selected, disabled, 'aria-label': label,
    }),
    h('span', { class: 'rn' },
      room.roomNumber,
      room.gender ? h('i', { class: `g ${room.gender === 'male' ? 'bg-male' : 'bg-female'}`, title: room.genderLabel }) : null),
    beds(room.capacity, { male: room.maleCount, female: room.femaleCount }));
  }

  function paint() {
    const visible = rooms.filter((r) => !onlyFitting || r.fits || r.current);
    const floors = [...new Set(visible.map((r) => r.floor))].sort((a, b) => a - b);
    body.replaceChildren(
      allowNone ? h('label', { class: 'room-tile room-none' },
        h('input', { type: 'radio', name, value: '', checked: selected === null }),
        h('span', { class: 'rn' }, 'Өрөөг дараа хуваарилах')) : null,
      ...floors.map((floor) => h('div', { class: 'floor-row' },
        h('div', { class: 'floor-label' }, `${floor}-р давхар`),
        h('div', { class: 'floor-rooms' }, visible.filter((r) => r.floor === floor).map(tile)))),
      visible.length === 0 ? h('p', { class: 'muted small' }, rooms.length
        ? 'Тохирох сул өрөө алга. Шүүлтийг арилгаж бүх өрөөг харна уу.'
        : 'Энэ байранд өрөө бүртгэгдээгүй байна. "Байр, өрөө" хэсгээс өрөө нэмнэ үү.') : null,
    );
  }

  toggle.querySelector('input').addEventListener('change', (e) => {
    const current = wrap.querySelector(`input[name="${name}"]:checked`);
    if (current) selected = current.value ? Number(current.value) : null;
    onlyFitting = e.target.checked;
    paint();
  });
  paint();
  wrap.append(body, h('div', { class: 'hint-row mt-8' },
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'lg-male' }), 'Эрэгтэй'),
      h('span', {}, h('i', { class: 'lg-female' }), 'Эмэгтэй'),
      h('span', {}, h('i', { class: 'lg-free' }), 'Сул ор')),
    toggle));
  return {
    el: wrap,
    value() {
      const checked = wrap.querySelector(`input[name="${name}"]:checked`);
      return checked && checked.value ? Number(checked.value) : null;
    },
  };
}
