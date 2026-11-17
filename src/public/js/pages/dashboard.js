/**
 * Оюутны нүүр хуудас: энэ жилийн хүсэлтийн төлөв, түүх, мэдээлэл, сул ор.
 */
import { h, $, render, params } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { initPage } from '../core/layout.js';
import {
  toast, confirmDialog, openModal, statusBadge, emptyState, loadingBlock, errorBlock, meter,
} from '../core/ui.js';
import {
  fmtDate, fmtDateTime, fmtPlainDate, money, firstName, yearLabel, timeAgo,
} from '../core/format.js';
import { dl, timeline, detailBlocks, roomText } from '../core/application-view.js';

const { user, meta } = await initPage({ role: 'student', active: 'dashboard', title: 'Нүүр' });
const windowInfo = meta.window;

$('#greeting').textContent = `Сайн байна уу, ${firstName(user.fullName)}`;
$('#year-line').textContent = `${yearLabel(windowInfo.academicYear)} хичээлийн жил, оюутны код ${user.username}`;

// Хүсэлт илгээсэн / зассаны дараах мэдэгдэл
const flash = params().get('submitted') ? 'Хүсэлт илгээгдлээ. Ажилтан хянаад шийдвэрийг мэдэгдэлээр илгээнэ.'
  : params().get('updated') ? 'Хүсэлтийн өөрчлөлтийг хадгаллаа.' : null;
if (flash) {
  render($('#flash'), h('div', { class: 'alert alert-ok flash', role: 'status' }, icon('check'), h('div', {}, flash)));
  window.history.replaceState(null, '', '/dashboard.html');
}

// ---------------- Хүсэлтийн төлөв ----------------
function windowLine() {
  if (!windowInfo.open) return h('div', { class: 'window-note' }, icon('clock', 'icon-sm'), windowInfo.message);
  return h('div', { class: 'window-note' }, icon('calendar', 'icon-sm'), windowInfo.deadline
    ? `Хүсэлтийг ${fmtPlainDate(windowInfo.deadline)} хүртэл хүлээн авна`
    : 'Хүсэлт хүлээн авч байна');
}

function applyButton(label = 'Хүсэлт илгээх') {
  return h('a', { class: 'btn', href: '/apply.html' }, icon('send'), label);
}

async function cancelApplication(app) {
  const ok = await confirmDialog({
    title: 'Хүсэлтээ цуцлах уу?',
    message: `Сонгосон байр: ${app.dormName}. Хүсэлт авах хугацаа дуусаагүй бол дахин илгээж болно.`,
    confirmLabel: 'Хүсэлтээ цуцлах',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.post(`/api/applications/${app.id}/cancel`);
    toast('Хүсэлтээ цуцаллаа');
    load();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/** Хүсэлтийн дэлгэрэнгүй (түүх, тайлбартай) — шинээр татна */
async function loadDetail(id) {
  const { application } = await api.get(`/api/applications/${id}`);
  return application;
}

function statusNone() {
  return [
    h('div', { class: 'status-top' }, h('div', {},
      h('h2', {}, 'Энэ жилийн хүсэлтээ илгээгээгүй байна'),
      h('p', {}, windowInfo.open
        ? 'Байраа сонгоод холбоо барих мэдээллээ бөглөхөд 3 минут орчим болно. Хүсэлтийн шийдвэрийг энд харна.'
        : 'Хүсэлт хүлээн авах хугацаа нээгдмэгц энд мэдэгдэнэ.'))),
    h('div', { class: 'status-actions' }, windowInfo.open ? applyButton() : null),
    h('div', { class: 'mt-16' }, windowLine()),
  ];
}

function statusApproved(app) {
  if (!app.roomNumber) {
    return [
      h('div', { class: 'status-top' }, h('div', {},
        statusBadge(app.status, app.statusLabel, true),
        h('h2', {}, 'Та байранд хамрагдлаа'),
        h('p', {}, `${app.dormName}. Өрөөг удахгүй хуваарилна, хуваарилагдмагц мэдэгдэл очно.`))),
      app.staffNote ? h('p', { class: 'quote mt-16' }, app.staffNote) : null,
      splitDetail(app),
    ];
  }
  return [
    h('div', { class: 'keytag-wrap' },
      h('div', { class: 'keytag', role: 'img', 'aria-label': `${app.dormName}, ${app.roomNumber} тоот өрөө` },
        h('div', { class: 'keytag-dorm' }, app.dormName),
        h('div', { class: 'keytag-room' }, app.roomNumber),
        h('div', { class: 'keytag-floor' }, app.roomFloor !== null ? `${app.roomFloor}-р давхар` : '')),
      h('div', { class: 'keytag-info' },
        statusBadge(app.status, app.statusLabel, true),
        h('h2', { class: 'mt-12' }, 'Таны өрөө бэлэн боллоо'),
        h('p', {}, 'Байранд орохдоо иргэний үнэмлэх, оюутны үнэмлэхээ авчирна уу.'),
        dl([
          ['Хаяг', app.dormAddress],
          ['Сарын төлбөр', app.dormFee ? money(app.dormFee) : null],
          ['Шийдвэрлэсэн', app.reviewedAt ? fmtDate(app.reviewedAt) : null],
        ]))),
    app.staffNote ? h('p', { class: 'quote mt-16' }, app.staffNote) : null,
    splitDetail(app),
  ];
}

function splitDetail(app) {
  return h('div', { class: 'status-split' },
    h('div', {}, h('h3', { class: 'block-title' }, 'Хүсэлтийн мэдээлэл'), dl([
      ['Байр', app.dormName],
      ['Өрөө', roomText(app)],
      ['Утас', app.phone],
      ['Яаралтай үед', `${app.emergencyName}, ${app.emergencyPhone}`],
      ['Илгээсэн', fmtDateTime(app.createdAt)],
    ])),
    h('div', {}, h('h3', { class: 'block-title' }, 'Явц'), timeline(app.events)));
}

function statusFor(app) {
  if (!app) return statusNone();
  if (app.status === 'APPROVED') return statusApproved(app);

  if (app.status === 'PENDING') {
    return [
      h('div', { class: 'status-top' }, h('div', {},
        statusBadge(app.status, app.statusLabel, true),
        h('h2', {}, 'Хүсэлт тань хянагдаж байна'),
        h('p', {}, `${app.dormName}. Ажилтан шийдвэрлэмэгц мэдэгдэл очно. Шийдвэр гарахаас өмнө хүсэлтээ засаж, цуцалж болно.`))),
      h('div', { class: 'status-actions' },
        windowInfo.open ? h('a', { class: 'btn btn-secondary', href: `/apply.html?id=${app.id}` }, icon('pencil'), 'Хүсэлт засах') : null,
        h('button', { class: 'btn btn-danger-quiet', type: 'button', onClick: () => cancelApplication(app) }, icon('x'), 'Хүсэлтээ цуцлах')),
      splitDetail(app),
    ];
  }
  if (app.status === 'REJECTED') {
    return [
      h('div', { class: 'status-top' }, h('div', {},
        statusBadge(app.status, app.statusLabel, true),
        h('h2', {}, 'Энэ удаад хүсэлт тань хангагдсангүй'),
        h('p', {}, 'Шийдвэрийн талаар асуух зүйл байвал дотуур байрны ажилтанд хандана уу.'))),
      app.staffNote ? h('div', { class: 'mt-16' }, h('h3', { class: 'block-title' }, 'Шалтгаан'), h('p', { class: 'quote' }, app.staffNote)) : null,
      splitDetail(app),
    ];
  }
  // CANCELLED — дахин илгээж болно
  return [
    h('div', { class: 'status-top' }, h('div', {},
      statusBadge(app.status, app.statusLabel, true),
      h('h2', {}, 'Та хүсэлтээ цуцалсан байна'),
      h('p', {}, windowInfo.open ? 'Байранд суух бол шинээр хүсэлт илгээнэ үү.' : windowInfo.message))),
    h('div', { class: 'status-actions' }, windowInfo.open ? applyButton('Дахин хүсэлт илгээх') : null),
  ];
}

// ---------------- Түүх ----------------
async function showDetail(id) {
  try {
    const app = await loadDetail(id);
    openModal({
      title: `Хүсэлт №${app.id}`,
      description: `${app.academicYear} хичээлийн жил, ${app.statusLabel.toLowerCase()}`,
      body: h('div', { class: 'stack' }, detailBlocks(app)),
      wide: true,
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

function historyTable(list) {
  if (list.length === 0) {
    return emptyState({ iconName: 'file', title: 'Илгээсэн хүсэлт байхгүй байна', text: 'Илгээсэн хүсэлтүүд тань энд хадгалагдана.' });
  }
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table table-cards' },
    h('thead', {}, h('tr', {}, ['№', 'Хичээлийн жил', 'Байр, өрөө', 'Илгээсэн', 'Төлөв', ''].map((t) => h('th', {}, t)))),
    h('tbody', {}, list.map((app) => h('tr', { class: 'clickable', onClick: () => showDetail(app.id) },
      h('td', { 'data-label': '№', class: 'num' }, `#${app.id}`),
      h('td', { 'data-label': 'Хичээлийн жил' }, app.academicYear),
      h('td', { 'data-label': 'Байр, өрөө' }, app.roomNumber ? `${app.dormName}, ${app.roomNumber}` : app.dormName),
      h('td', { 'data-label': 'Илгээсэн', class: 'nowrap' }, fmtDate(app.createdAt)),
      h('td', { 'data-label': 'Төлөв' }, statusBadge(app.status, app.statusLabel)),
      h('td', { class: 'right' }, h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': `Хүсэлт №${app.id}-ийн дэлгэрэнгүй`,
      }, icon('chevronRight'))))))));
}

// ---------------- Мэдээлэл, сул ор ----------------
function announcementsList(list) {
  if (list.length === 0) return h('p', { class: 'muted small' }, 'Одоогоор мэдээлэл алга.');
  return list.slice(0, 5).map((a) => h('article', { class: 'announce' },
    h('h3', {}, a.isPinned ? h('span', { title: 'Онцолсон', 'aria-label': 'Онцолсон' }, icon('pin', 'icon-sm')) : null, a.title),
    h('p', {}, a.body),
    h('time', {}, timeAgo(a.createdAt))));
}

function dormList(dorms) {
  if (dorms.length === 0) return h('p', { class: 'muted small' }, 'Танд тохирох байр одоогоор алга.');
  return h('div', { class: 'occ-list' }, dorms.map((d) => h('div', {},
    h('div', { class: 'occ-row-head' },
      h('strong', {}, d.name, h('span', { class: 'muted small' }, ` ${d.genderLabel.toLowerCase()}`)),
      h('span', { class: 'num' }, d.available > 0 ? `${d.available} сул ор` : 'Дүүрсэн')),
    meter(d.capacity, d.approved, 0),
    h('div', { class: 'hint mt-8' }, `${money(d.monthlyFee)} / сар`))));
}

// ---------------- Ачаалах ----------------
async function load() {
  const status = $('#status');
  render(status, loadingBlock());
  try {
    const [{ applications }, { announcements }, { dormitories }] = await Promise.all([
      api.get('/api/applications/my'),
      api.get('/api/announcements'),
      api.get('/api/dormitories'),
    ]);
    const current = applications.find((a) => a.academicYear === windowInfo.academicYear) || null;
    const detailed = current ? await loadDetail(current.id) : null;
    render(status, statusFor(detailed));
    render($('#history'), historyTable(applications));
    render($('#announcements'), announcementsList(announcements));
    render($('#dorms'), dormList(dormitories));
  } catch (err) {
    render(status, errorBlock(err.message, load));
  }
}

load();
