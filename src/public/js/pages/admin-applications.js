/**
 * Ажилтан: хүсэлтүүдийн жагсаалт (шүүлт, хайлт, хуудаслалт) ба шийдвэрлэх самбар.
 * Шүүлтүүд URL-д хадгалагдана — хуудсыг сэргээсэн ч, холбоос хуваалцсан ч хадгалагдана.
 */
import { h, $, render, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api, qs } from '../core/api.js';
import { initPage } from '../core/layout.js';
import {
  toast, confirmDialog, statusBadge, emptyState, loadingBlock, errorBlock, options, setBusy, clearErrors, showErrors,
} from '../core/ui.js';
import { fmtDate, fmtDateTime, timeAgo, yearLabel } from '../core/format.js';
import { dl, tagChips, timeline, roomText } from '../core/application-view.js';
import { roomPicker } from '../core/room-picker.js';

const { meta, shell } = await initPage({ role: 'staff', active: 'applications', title: 'Хүсэлтүүд' });
const STATUS_TABS = [['', 'Бүгд'], ['PENDING', 'Хүлээгдэж буй'], ['APPROVED', 'Зөвшөөрсөн'], ['REJECTED', 'Татгалзсан'], ['CANCELLED', 'Цуцалсан']];

const url = new URLSearchParams(window.location.search);
const state = {
  q: url.get('q') || '',
  status: url.get('status') || '',
  dormId: url.get('dormId') || '',
  year: url.get('year') ?? meta.window.academicYear,
  sort: url.get('sort') || 'newest',
  page: Number(url.get('page')) || 1,
};
let openId = url.get('id') ? Number(url.get('id')) : null;
let rows = [];

const form = $('#filters');
form.q.value = state.q;
form.sort.value = state.sort;
$('.input-search', form).prepend(icon('search'));
$('#export').append(icon('download'), 'CSV татах');

function syncUrl() {
  const query = qs({ ...state, page: state.page > 1 ? state.page : '', id: openId || '' });
  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
  $('#export').href = `/api/admin/applications/export${qs({ ...state, page: '' })}`;
}

// ---------------- Шүүлтүүд ----------------
async function loadFilters() {
  const [{ dormitories }, stats] = await Promise.all([api.get('/api/admin/dorms'), api.get('/api/admin/stats')]);
  render(form.dormId, options(dormitories.map((d) => [d.id, d.name]), state.dormId, 'Бүх байр'));
  render(form.year, options([...stats.years.map((y) => [y, yearLabel(y)]), ['all', 'Бүх жил']], state.year));
}

form.addEventListener('submit', (e) => e.preventDefault());
form.q.addEventListener('input', debounce(() => { state.q = form.q.value.trim(); state.page = 1; load(); }, 300));
['dormId', 'year', 'sort'].forEach((name) => form[name].addEventListener('change', () => {
  state[name] = form[name].value;
  state.page = 1;
  load();
}));

function renderTabs(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  render($('#status-tabs'), STATUS_TABS.map(([value, label]) => h('button', {
    type: 'button',
    'aria-pressed': String(state.status === value),
    onClick: () => { state.status = value; state.page = 1; load(); },
  }, label, h('span', { class: 'count' }, value ? counts[value] : total))));
}

// ---------------- Хүснэгт ----------------
function renderTable(data) {
  if (data.applications.length === 0) {
    const filtered = state.q || state.dormId || state.status;
    render($('#table'), emptyState({
      iconName: 'inbox',
      title: filtered ? 'Шүүлтэд тохирох хүсэлт алга' : 'Энэ жил хүсэлт ирээгүй байна',
      text: filtered ? 'Хайлтын үг, шүүлтээ өөрчилж үзнэ үү.' : 'Оюутнууд хүсэлт илгээмэгц энд харагдана.',
    }));
    return;
  }
  render($('#table'), h('div', { class: 'table-wrap' }, h('table', { class: 'table table-cards' },
    h('thead', {}, h('tr', {}, ['Оюутан', 'Байр, өрөө', 'Аймаг, курс', 'Давуу эрх', 'Илгээсэн', 'Төлөв'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, data.applications.map((a) => {
      const tr = h('tr', { class: `clickable${a.id === openId ? ' is-selected' : ''}`, dataset: { id: a.id } },
        h('td', { class: 'td-main' }, h('div', { class: 'person' },
          h('strong', {}, h('button', { class: 'link-btn row-link', type: 'button' }, a.student.name)),
          h('span', {}, `${a.student.code}, ${a.student.genderLabel.toLowerCase()}`))),
        h('td', { 'data-label': 'Байр, өрөө' }, a.dormName, a.roomNumber ? h('span', { class: 'muted' }, `, ${a.roomNumber}`) : null),
        h('td', { 'data-label': 'Аймаг, курс' }, [a.homeProvince, a.courseLabel].filter(Boolean).join(', ') || '—'),
        h('td', { 'data-label': 'Давуу эрх' }, a.priorityTags.length
          ? h('span', { class: 'chip chip-brass', title: a.priorityLabels.join(', ') }, `${a.priorityTags.length} ангилал`)
          : h('span', { class: 'muted' }, '—')),
        h('td', { 'data-label': 'Илгээсэн', class: 'nowrap', title: fmtDateTime(a.createdAt) }, timeAgo(a.createdAt)),
        h('td', { 'data-label': 'Төлөв' }, statusBadge(a.status, a.statusLabel)));
      tr.addEventListener('click', () => openDrawer(a.id));
      return tr;
    })))));
}

function renderPager(data) {
  if (data.total === 0) { render($('#pager')); return; }
  const from = (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);
  const go = (page) => { state.page = page; load(); };
  render($('#pager'), h('div', { class: 'pager' },
    h('span', { class: 'num' }, `${data.total}-аас ${from}–${to}`),
    h('div', { class: 'pager-btns' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: data.page <= 1, onClick: () => go(data.page - 1), 'aria-label': 'Өмнөх хуудас' }, icon('chevronLeft', 'icon-sm'), 'Өмнөх'),
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: data.page >= data.pages, onClick: () => go(data.page + 1), 'aria-label': 'Дараагийн хуудас' }, 'Дараах', icon('chevronRight', 'icon-sm')))));
}

let loadToken = 0;
async function load() {
  const token = ++loadToken;
  syncUrl();
  if (!rows.length) render($('#table'), loadingBlock());
  try {
    const data = await api.get(`/api/admin/applications${qs({ ...state, pageSize: 20 })}`);
    if (token !== loadToken) return; // хуучин хариуг алгасна
    rows = data.applications;
    state.page = data.page;
    renderTabs(data.counts);
    renderTable(data);
    renderPager(data);
  } catch (err) {
    render($('#table'), errorBlock(err.message, load));
  }
}

// ---------------- Шийдвэрлэх самбар ----------------
const drawer = h('dialog', { class: 'drawer', 'aria-labelledby': 'drawer-title' });
document.body.append(drawer);
drawer.addEventListener('close', () => {
  openId = null;
  syncUrl();
  document.querySelectorAll('tr.is-selected').forEach((tr) => tr.classList.remove('is-selected'));
});
drawer.addEventListener('mousedown', (e) => { if (e.target === drawer) drawer.close(); });

async function refreshPendingCount() {
  try {
    const data = await api.get('/api/admin/applications?pageSize=1');
    shell.pendingCount.textContent = String(data.counts.PENDING);
    shell.pendingCount.hidden = data.counts.PENDING === 0;
  } catch (e) { /* зүгээр */ }
}

/** Шийдвэрийн дараа: жагсаалт, самбар, цэсний тоог шинэчилнэ */
async function afterAction(message, application) {
  toast(message);
  renderDrawer(application);
  load();
  refreshPendingCount();
}

function noteField(name, label, { required = false, placeholder = '' } = {}) {
  return h('div', { class: 'field', dataset: { field: name } },
    h('label', { for: `d-${name}` }, label, required ? null : h('span', { class: 'optional' }, ' (заавал биш)')),
    h('textarea', { class: 'textarea', id: `d-${name}`, name, maxlength: '500', rows: 3, placeholder }),
    h('div', { class: 'field-error', 'aria-live': 'polite' }));
}

async function decisionPending(app, box) {
  const roomsBox = h('div', {}, loadingBlock());
  const decide = h('form', { class: 'decide', novalidate: true });
  let mode = 'approve';
  let picker = null;

  const modeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Шийдвэр' },
    h('label', {}, h('input', { type: 'radio', name: 'mode', value: 'approve', checked: true }), icon('check', 'icon-sm'), 'Зөвшөөрөх'),
    h('label', {}, h('input', { type: 'radio', name: 'mode', value: 'reject' }), icon('x', 'icon-sm'), 'Татгалзах'));
  const approvePart = h('div', { class: 'stack' },
    h('div', { class: 'field', dataset: { field: 'roomId' } },
      h('span', { class: 'field-label' }, 'Өрөө хуваарилах'),
      roomsBox,
      h('div', { class: 'field-error', 'aria-live': 'polite' })),
    noteField('note', 'Оюутанд очих тайлбар', { placeholder: 'Жишээ: 9-р сарын 1-нд 10:00 цагт байранд ирнэ үү' }));
  const rejectPart = h('div', { hidden: true },
    noteField('rejectNote', 'Татгалзсан шалтгаан', { required: true, placeholder: 'Оюутан энэ тайлбарыг мэдэгдлээр авна' }));
  const submit = h('button', { class: 'btn btn-ok', type: 'submit' }, icon('check'), 'Зөвшөөрөх');

  modeSeg.addEventListener('change', (e) => {
    mode = e.target.value;
    approvePart.hidden = mode !== 'approve';
    rejectPart.hidden = mode !== 'reject';
    submit.className = `btn ${mode === 'approve' ? 'btn-ok' : 'btn-danger'}`;
    submit.replaceChildren(icon(mode === 'approve' ? 'check' : 'x'), mode === 'approve' ? 'Зөвшөөрөх' : 'Татгалзах');
    clearErrors(decide);
  });

  decide.append(modeSeg, approvePart, rejectPart, h('div', { class: 'decide-actions' }, submit));
  decide.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(decide);
    setBusy(submit, true);
    try {
      let data;
      if (mode === 'approve') {
        data = await api.post(`/api/admin/applications/${app.id}/approve`, {
          roomId: picker ? picker.value() : null,
          note: decide.note.value.trim() || null,
        });
      } else {
        const note = decide.rejectNote.value.trim();
        if (note.length < 5) {
          showErrors(decide, { rejectNote: 'Татгалзсан шалтгааныг оюутанд тайлбарлана уу (5-аас дээш тэмдэгт)' });
          setBusy(submit, false);
          return;
        }
        data = await api.post(`/api/admin/applications/${app.id}/reject`, { note });
      }
      afterAction(data.message, data.application);
    } catch (err) {
      setBusy(submit, false);
      if (err.details) showErrors(decide, { ...err.details, ...(err.details.note ? { rejectNote: err.details.note } : {}) });
      toast(err.message, 'error');
    }
  });
  box.append(h('h3', { class: 'block-title' }, icon('key', 'icon-sm'), 'Шийдвэр'), decide);

  try {
    const roomData = await api.get(`/api/admin/applications/${app.id}/rooms`);
    const d = roomData.dorm;
    picker = roomPicker({ rooms: roomData.rooms, selected: roomData.suggestedRoomId, suggested: roomData.suggestedRoomId });
    render(roomsBox,
      h('p', { class: 'hint' }, `${d.name}: ${d.approved}/${d.capacity} ор эзэмшигдсэн.`,
        roomData.suggestedRoomId ? ' Тохирох өрөөг урьдчилан сонгосон (хагас дүүрсэн өрөөг эхэлж дүүргэнэ).' : ''),
      d.approved >= d.capacity ? h('div', { class: 'alert alert-error mt-8' }, icon('alert'), h('div', {}, 'Байр дүүрсэн тул зөвшөөрөх боломжгүй.')) : null,
      h('div', { class: 'mt-8' }, picker.el));
  } catch (err) {
    render(roomsBox, h('p', { class: 'field-error' }, err.message));
  }
}

async function decisionApproved(app, box) {
  const roomsBox = h('div', {}, loadingBlock());
  let picker = null;
  const save = h('button', { class: 'btn', type: 'button' }, 'Өрөө хадгалах');
  const reopen = h('button', { class: 'btn btn-ghost', type: 'button' }, icon('undo'), 'Шийдвэр буцаах');
  box.append(
    h('h3', { class: 'block-title' }, icon('key', 'icon-sm'), 'Өрөө'),
    h('div', { class: 'field', dataset: { field: 'roomId' } }, roomsBox, h('div', { class: 'field-error', 'aria-live': 'polite' })),
    h('div', { class: 'decide-actions mt-12' }, reopen, save));

  save.addEventListener('click', async () => {
    clearErrors(box);
    setBusy(save, true);
    try {
      const data = await api.post(`/api/admin/applications/${app.id}/room`, { roomId: picker ? picker.value() : null });
      afterAction(data.message, data.application);
    } catch (err) {
      setBusy(save, false);
      if (err.details) showErrors(box, err.details);
      toast(err.message, 'error');
    }
  });
  reopen.addEventListener('click', () => reopenApp(app));

  try {
    const roomData = await api.get(`/api/admin/applications/${app.id}/rooms`);
    picker = roomPicker({ rooms: roomData.rooms, selected: app.roomId, suggested: app.roomId ? null : roomData.suggestedRoomId });
    render(roomsBox, picker.el);
  } catch (err) {
    render(roomsBox, h('p', { class: 'field-error' }, err.message));
  }
}

async function reopenApp(app) {
  const ok = await confirmDialog({
    title: 'Шийдвэрийг буцаах уу?',
    message: 'Хүсэлт дахин "Хүлээгдэж буй" төлөвт орж, өрөөний хуваарилалт цуцлагдана. Оюутанд мэдэгдэл очно.',
    confirmLabel: 'Шийдвэр буцаах',
  });
  if (!ok) return;
  try {
    const data = await api.post(`/api/admin/applications/${app.id}/reopen`, {});
    afterAction(data.message, data.application);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderDrawer(app) {
  const index = rows.findIndex((r) => r.id === app.id);
  const nav = (delta, label, iconName) => {
    const target = rows[index + delta];
    return h('button', {
      class: 'icon-btn', type: 'button', 'aria-label': label, title: label, disabled: !target,
      onClick: () => target && openDrawer(target.id),
    }, icon(iconName));
  };

  const decision = h('section', {});
  if (app.status === 'PENDING') decisionPending(app, decision);
  else if (app.status === 'APPROVED') decisionApproved(app, decision);
  else if (app.status === 'REJECTED') {
    decision.append(h('div', { class: 'decide-actions' },
      h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => reopenApp(app) }, icon('undo'), 'Шийдвэр буцааж дахин хянах')));
  } else {
    decision.append(h('p', { class: 'muted small' }, 'Оюутан энэ хүсэлтээ цуцалсан.'));
  }

  render(drawer,
    h('div', { class: 'drawer-head' },
      h('div', {},
        h('h2', { id: 'drawer-title' }, app.student.name),
        h('div', { class: 'meta' }, `${app.student.code}, ${app.student.genderLabel.toLowerCase()}, №${app.id}`, statusBadge(app.status, app.statusLabel))),
      h('div', { class: 'drawer-nav' },
        index >= 0 ? nav(-1, 'Өмнөх хүсэлт', 'chevronLeft') : null,
        index >= 0 ? nav(1, 'Дараагийн хүсэлт', 'chevronRight') : null,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Хаах', onClick: () => drawer.close() }, icon('x')))),
    h('div', { class: 'drawer-body' },
      h('section', {},
        dl([
          ['Байр', app.dormName],
          ['Өрөө', roomText(app)],
          ['Аймаг, хот', app.homeProvince],
          ['Курс', app.courseLabel],
          ['Хичээлийн жил', app.academicYear],
          ['Илгээсэн', `${fmtDateTime(app.createdAt)} (${timeAgo(app.createdAt)})`],
        ]),
        app.priorityLabels.length ? h('div', { class: 'mt-12' }, tagChips(app)) : null),
      h('section', {}, h('h3', { class: 'block-title' }, icon('file', 'icon-sm'), 'Байранд суух шалтгаан'), h('p', { class: 'quote' }, app.reason)),
      decision,
      h('section', {}, h('h3', { class: 'block-title' }, icon('phone', 'icon-sm'), 'Холбоо барих'), dl([
        ['Утас', h('a', { href: `tel:${app.phone}` }, app.phone)],
        ['Имэйл', h('a', { href: `mailto:${app.student.email}` }, app.student.email)],
        ['Яаралтай үед', app.emergencyRelation ? `${app.emergencyName} (${app.emergencyRelation})` : app.emergencyName],
        ['Түүний утас', h('a', { href: `tel:${app.emergencyPhone}` }, app.emergencyPhone)],
      ])),
      app.staffNote ? h('section', {}, h('h3', { class: 'block-title' }, 'Ажилтны тайлбар'), h('p', { class: 'quote' }, app.staffNote)) : null,
      h('section', {}, h('h3', { class: 'block-title' }, icon('clock', 'icon-sm'), 'Түүх'), timeline(app.events)),
      app.reviewedAt ? h('p', { class: 'hint' }, `Шийдвэрлэсэн: ${app.reviewerName || '—'}, ${fmtDate(app.reviewedAt)}`) : null));
}

async function openDrawer(id) {
  openId = id;
  syncUrl();
  document.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('is-selected', Number(tr.dataset.id) === id));
  if (!drawer.open) drawer.showModal();
  render(drawer, loadingBlock());
  try {
    const { application } = await api.get(`/api/applications/${id}`);
    renderDrawer(application);
  } catch (err) {
    render(drawer, h('div', { class: 'drawer-body' }, errorBlock(err.message, () => openDrawer(id))));
  }
}

await loadFilters().catch((err) => toast(err.message, 'error'));
await load();
if (openId) openDrawer(openId);
