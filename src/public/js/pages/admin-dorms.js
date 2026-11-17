/**
 * Ажилтан: байр, өрөөний удирдлага.
 * Давхрын зураглал нь дээд давхрыг дээр нь харуулдаг — байрны фасад шиг.
 */
import { h, $, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api, qs } from '../core/api.js';
import { initPage } from '../core/layout.js';
import {
  toast, confirmDialog, openModal, formModal, switchField, field, options, beds, meter, loadingBlock, errorBlock, emptyState,
} from '../core/ui.js';
import { money, yearLabel } from '../core/format.js';

const { meta } = await initPage({ role: 'staff', active: 'dorms', title: 'Байр, өрөө' });
const url = new URLSearchParams(window.location.search);
let year = url.get('year') || meta.window.academicYear;
let selectedId = Number(url.get('dorm')) || null;
let dorms = [];

$('#add-dorm').append(icon('plus'), 'Байр нэмэх');
$('#add-dorm').addEventListener('click', () => dormForm(null));

function syncUrl() {
  window.history.replaceState(null, '', qs({ year: year === meta.window.academicYear ? '' : year, dorm: selectedId || '' }) || window.location.pathname);
}

// ---------------- Байрны жагсаалт ----------------
function renderTabs() {
  if (dorms.length === 0) {
    render($('#dorm-tabs'));
    render($('#dorm-detail'), emptyState({
      iconName: 'building', title: 'Байр бүртгэгдээгүй байна', text: 'Эхлээд байраа нэмээд, дараа нь өрөөнүүдийг нь үүсгэнэ.',
      action: h('button', { class: 'btn', type: 'button', onClick: () => dormForm(null) }, icon('plus'), 'Байр нэмэх'),
    }));
    return;
  }
  render($('#dorm-tabs'), dorms.map((d) => h('button', {
    class: 'dorm-tab', type: 'button', 'aria-pressed': String(d.id === selectedId),
    onClick: () => { selectedId = d.id; syncUrl(); renderTabs(); loadRooms(); },
  },
  h('strong', {}, d.name, d.isActive ? null : h('span', { class: 'chip' }, 'Хаалттай')),
  h('span', {}, `${d.genderLabel}, ${d.approved}/${d.capacity} ор`),
  meter(d.capacity, d.approved, d.pending))));
}

// ---------------- Байрны дэлгэрэнгүй ----------------
function summary(d) {
  const item = (value, label) => h('div', {}, h('strong', {}, value), h('span', {}, label));
  return h('div', { class: 'dorm-summary' },
    item(d.capacity, 'багтаамж'),
    item(d.approved, 'байрлаж буй'),
    item(d.pending, 'хүсэлт хүлээгдэж буй'),
    item(`${d.roomCount}`, `өрөө, ${d.roomBeds} ор`),
    item(money(d.monthlyFee), 'сарын төлбөр'));
}

function roomButton(room) {
  const free = room.capacity - room.occupied;
  const stateClass = free === 0 ? ' is-full' : room.occupied === 0 ? ' is-empty' : '';
  const names = room.residents.map((r) => r.fullName).join(', ');
  return h('button', {
    class: `fp-room${stateClass}${room.gender ? ` is-g-${room.gender}` : ''}`, type: 'button',
    title: names || 'Хоосон өрөө',
    'aria-label': `${room.roomNumber} тоот, ${room.occupied}/${room.capacity} ор${names ? `: ${names}` : ''}`,
    onClick: () => roomModal(room),
  },
  h('span', { class: 'rn' }, room.roomNumber, h('small', {}, `${room.occupied}/${room.capacity}`)),
  beds(room.capacity, { male: room.maleCount, female: room.femaleCount }));
}

function floorplan(rooms) {
  if (rooms.length === 0) {
    return emptyState({
      iconName: 'door', title: 'Өрөө бүртгэгдээгүй байна',
      text: 'Давхар бүрт хэдэн өрөө байгааг оруулаад олон өрөөг нэг дор үүсгэнэ.',
      action: h('button', { class: 'btn', type: 'button', onClick: bulkForm }, icon('layers'), 'Өрөөнүүд үүсгэх'),
    });
  }
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => b - a);
  return h('div', { class: 'floorplan' }, floors.map((floor) => h('div', { class: 'fp-floor' },
    h('div', { class: 'fp-label' }, `${floor}-р давхар`),
    h('div', { class: 'fp-rooms' }, rooms.filter((r) => r.floor === floor).map(roomButton)))));
}

async function loadRooms() {
  const box = $('#dorm-detail');
  if (!selectedId) return;
  render(box, loadingBlock());
  try {
    const data = await api.get(`/api/admin/dorms/${selectedId}/rooms${qs({ year })}`);
    const d = data.dorm;
    const warnings = [];
    if (d.roomCount > 0 && d.roomBeds !== d.capacity) {
      warnings.push(h('div', { class: 'alert alert-wait' }, icon('alert'), h('div', {},
        `Өрөөнүүдийн нийт ор (${d.roomBeds}) байрны багтаамжаас (${d.capacity}) ${d.roomBeds < d.capacity ? 'бага' : 'их'} байна. `,
        'Багтаамжийг засах эсвэл өрөө нэмнэ үү.')));
    }
    if (data.unassigned.length) {
      warnings.push(h('div', { class: 'alert alert-info' }, icon('info'), h('div', {},
        h('strong', {}, `${data.unassigned.length} оюутанд өрөө хуваарилаагүй байна`),
        h('div', { class: 'chips mt-8' }, data.unassigned.map((r) => h('a', {
          class: 'chip chip-lapis', href: `/admin/applications.html?id=${r.applicationId}&status=APPROVED&year=${year}`,
        }, r.fullName))))));
    }

    render(box,
      h('div', { class: 'panel-head' },
        h('h2', {}, d.name, ' ', h('span', { class: 'chip' }, d.genderLabel)),
        h('div', { class: 'table-actions' },
          h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onClick: () => dormForm(d) }, icon('pencil', 'icon-sm'), 'Засах'),
          h('button', { class: 'btn btn-danger-quiet btn-sm', type: 'button', onClick: () => deleteDorm(d) }, icon('trash', 'icon-sm'), 'Устгах'))),
      h('div', { class: 'panel-body stack' },
        d.address || d.description ? h('p', { class: 'muted small' }, [d.address, d.description].filter(Boolean).join('. ')) : null,
        summary(d),
        ...warnings),
      h('div', { class: 'toolbar' },
        h('h3', { class: 'section-title' }, 'Давхрын зураглал'),
        h('div', { class: 'legend' },
          h('span', {}, h('i', { class: 'lg-male' }), 'Эрэгтэй'),
          h('span', {}, h('i', { class: 'lg-female' }), 'Эмэгтэй'),
          h('span', {}, h('i', { class: 'lg-free' }), 'Сул ор'),
          d.genderType === 'mixed' ? h('span', {}, 'Зүүн талын өнгөт зураас = өрөөний хүйс') : null),
        h('div', { class: 'table-actions grow-left' },
          h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onClick: () => roomForm(null) }, icon('plus', 'icon-sm'), 'Өрөө нэмэх'),
          h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onClick: bulkForm }, icon('layers', 'icon-sm'), 'Олон өрөө үүсгэх'))),
      h('div', { class: 'panel-body' }, floorplan(data.rooms)));
  } catch (err) {
    render(box, errorBlock(err.message, loadRooms));
  }
}

async function load() {
  render($('#dorm-detail'), loadingBlock());
  try {
    const [{ dormitories }, stats] = await Promise.all([api.get(`/api/admin/dorms${qs({ year })}`), api.get('/api/admin/stats')]);
    dorms = dormitories;
    render($('#year'), options(stats.years.map((y) => [y, `${yearLabel(y)} хичээлийн жил`]), year));
    if (!dorms.some((d) => d.id === selectedId)) selectedId = dorms[0]?.id || null;
    syncUrl();
    renderTabs();
    loadRooms();
  } catch (err) {
    render($('#dorm-detail'), errorBlock(err.message, load));
  }
}

$('#year').addEventListener('change', (e) => { year = e.target.value; load(); });

// ---------------- Байр нэмэх / засах ----------------
function dormForm(dorm) {
  const input = (attrs, value) => Object.assign(h('input', { class: 'input', ...attrs }), { value: value ?? '' });
  const genderSelect = h('select', { class: 'select' }, options(Object.entries(meta.dormGenders), dorm?.genderType || '', 'Сонгох'));
  const description = h('textarea', { class: 'textarea', maxlength: '1000', rows: 3 });
  description.value = dorm?.description || '';

  formModal({
    title: dorm ? `${dorm.name} засах` : 'Байр нэмэх',
    fields: [
      h('div', { class: 'form-row' },
        field({ label: 'Нэр', name: 'name', input: input({ maxlength: '60', placeholder: '4-р байр' }, dorm?.name) }),
        field({ label: 'Хэнд зориулсан', name: 'genderType', input: genderSelect })),
      h('div', { class: 'form-row' },
        field({ label: 'Багтаамж (ор)', name: 'capacity', input: input({ type: 'number', min: '1', max: '5000', inputmode: 'numeric' }, dorm?.capacity) }),
        field({ label: 'Сарын төлбөр (₮)', name: 'monthlyFee', input: input({ type: 'number', min: '0', step: '1000', inputmode: 'numeric' }, dorm?.monthlyFee ?? 0) })),
      field({ label: 'Хаяг', name: 'address', optional: true, input: input({ maxlength: '200' }, dorm?.address) }),
      field({ label: 'Тайлбар', name: 'description', optional: true, input: description, hint: 'Оюутан байр сонгохдоо харна: өрөөний төрөл, тохижилт.' }),
      switchField({ name: 'isActive', label: 'Хүсэлт хүлээн авах', text: 'Унтраавал оюутан энэ байрыг сонгох боломжгүй болно.', checked: dorm ? dorm.isActive : true }),
    ],
    submitLabel: dorm ? 'Хадгалах' : 'Байр нэмэх',
    async onSubmit(form) {
      const body = {
        name: form.elements.namedItem('name').value.trim(),
        genderType: form.genderType.value,
        capacity: form.capacity.value,
        monthlyFee: form.monthlyFee.value,
        address: form.address.value.trim(),
        description: form.description.value.trim(),
        isActive: form.isActive.checked,
      };
      const data = dorm ? await api.put(`/api/admin/dorms/${dorm.id}`, body) : await api.post('/api/admin/dorms', body);
      selectedId = data.dorm.id;
      load();
      return data.message;
    },
  });
}

async function deleteDorm(d) {
  const ok = await confirmDialog({
    title: 'Байрыг устгах уу?',
    message: `${d.name} болон бүх өрөө нь устана. Хүсэлт ирсэн байрыг устгах боломжгүй — оронд нь "Хүсэлт хүлээн авах"-ыг унтраана уу.`,
    confirmLabel: 'Устгах',
    danger: true,
  });
  if (!ok) return;
  try {
    const data = await api.del(`/api/admin/dorms/${d.id}`);
    toast(data.message);
    selectedId = null;
    load();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------------- Өрөө ----------------
function currentDorm() {
  return dorms.find((d) => d.id === selectedId);
}

function roomGenderField(value) {
  const dorm = currentDorm();
  if (dorm && dorm.genderType !== 'mixed') return null; // эрэгтэй/эмэгтэй байранд шаардлагагүй
  return field({
    label: 'Өрөөний хүйс', name: 'gender', optional: true,
    input: h('select', { class: 'select' }, options([['male', 'Эрэгтэй'], ['female', 'Эмэгтэй']], value || '', 'Заагаагүй')),
    hint: 'Заагаагүй бол эхний оюутны хүйсээр тодорхойлогдоно.',
  });
}

function roomForm(room) {
  const input = (attrs, value) => Object.assign(h('input', { class: 'input', ...attrs }), { value: value ?? '' });
  formModal({
    title: room ? `${room.roomNumber} тоот өрөө засах` : 'Өрөө нэмэх',
    fields: [
      h('div', { class: 'form-row-3' },
        field({ label: 'Дугаар', name: 'roomNumber', input: input({ maxlength: '10', placeholder: '101' }, room?.roomNumber) }),
        field({ label: 'Давхар', name: 'floor', input: input({ type: 'number', min: '0', max: '30' }, room?.floor ?? 1) }),
        field({ label: 'Орны тоо', name: 'capacity', input: input({ type: 'number', min: '1', max: '12' }, room?.capacity ?? 3) })),
      roomGenderField(room?.gender),
    ],
    submitLabel: room ? 'Хадгалах' : 'Өрөө нэмэх',
    async onSubmit(form) {
      const body = {
        roomNumber: form.roomNumber.value.trim(),
        floor: form.floor.value,
        capacity: form.capacity.value,
        gender: form.gender ? form.gender.value || null : null,
      };
      const data = room ? await api.put(`/api/admin/rooms/${room.id}`, body) : await api.post(`/api/admin/dorms/${selectedId}/rooms`, body);
      load();
      return data.message;
    },
  });
}

function bulkForm() {
  const input = (attrs, value) => Object.assign(h('input', { class: 'input', type: 'number', ...attrs }), { value });
  const preview = h('div', { class: 'alert alert-info' }, icon('info'), h('div', {}));
  const { form } = formModal({
    title: 'Олон өрөө үүсгэх',
    description: 'Өрөөний дугаар давхар + дараалал байна: 101, 102 … 201, 202. Байгаа дугаарыг алгасна.',
    fields: [
      h('div', { class: 'form-row' },
        field({ label: 'Эхний давхар', name: 'floorFrom', input: input({ min: '0', max: '30' }, 1) }),
        field({ label: 'Сүүлийн давхар', name: 'floorTo', input: input({ min: '0', max: '30' }, 5) })),
      h('div', { class: 'form-row' },
        field({ label: 'Давхар бүрийн өрөө', name: 'roomsPerFloor', input: input({ min: '1', max: '50' }, 8) }),
        field({ label: 'Өрөө бүрийн ор', name: 'capacity', input: input({ min: '1', max: '12' }, 3) })),
      roomGenderField(null),
      preview,
    ],
    submitLabel: 'Үүсгэх',
    async onSubmit(f) {
      const data = await api.post(`/api/admin/dorms/${selectedId}/rooms/bulk`, {
        floorFrom: f.floorFrom.value, floorTo: f.floorTo.value, roomsPerFloor: f.roomsPerFloor.value,
        capacity: f.capacity.value, gender: f.gender ? f.gender.value || null : null,
      });
      load();
      return data.message;
    },
  });
  const update = () => {
    const from = Number(form.floorFrom.value);
    const to = Number(form.floorTo.value);
    const per = Number(form.roomsPerFloor.value);
    const cap = Number(form.capacity.value);
    const text = preview.lastChild;
    if (!(to >= from) || !per || !cap) { text.textContent = 'Утгуудаа шалгана уу.'; return; }
    const count = (to - from + 1) * per;
    const pad = (n) => String(n).padStart(2, '0');
    text.textContent = `${from}${pad(1)}–${from}${pad(per)}${to > from ? ` … ${to}${pad(1)}–${to}${pad(per)}` : ''}: нийт ${count} өрөө, ${count * cap} ор.`;
  };
  form.addEventListener('input', update);
  update();
}

function roomModal(room) {
  const residents = room.residents.length
    ? h('ul', { class: 'resident-list' }, room.residents.map((r) => h('li', {},
      h('span', { class: `avatar g-${r.gender}`, 'aria-hidden': 'true' }, r.fullName.slice(0, 1)),
      h('div', { class: 'grow' }, h('strong', {}, r.fullName), h('div', { class: 'muted small' }, r.username)),
      h('a', { class: 'btn btn-ghost btn-sm', href: `/admin/applications.html?id=${r.applicationId}&status=APPROVED&year=${year}` }, 'Хүсэлт'))))
    : h('p', { class: 'muted' }, 'Энэ өрөөнд одоогоор хүн байрлаагүй.');

  openModal({
    title: `${room.roomNumber} тоот өрөө`,
    description: `${room.floor}-р давхар, ${room.occupied}/${room.capacity} ор${room.genderLabel ? `, ${room.genderLabel.toLowerCase()}` : ''}`,
    body: h('div', {}, h('h3', { class: 'block-title' }, 'Оршин суугчид'), residents),
    actions: [
      {
        label: 'Устгах',
        variant: 'btn-danger-quiet',
        onClick: async (e, close) => {
          close();
          const ok = await confirmDialog({ title: `${room.roomNumber} тоот өрөөг устгах уу?`, message: 'Өрөөний мэдээлэл устна.', confirmLabel: 'Устгах', danger: true });
          if (!ok) return;
          try {
            const data = await api.del(`/api/admin/rooms/${room.id}`);
            toast(data.message);
            load();
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      },
      { label: 'Засах', variant: 'btn-secondary', onClick: (e, close) => { close(); roomForm(room); } },
    ],
  });
}

load();
