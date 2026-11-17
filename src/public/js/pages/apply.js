/**
 * US-01: Дотуур байранд суух хүсэлт илгээх / засах.
 * 3 алхам: 1) байр (манай сургууль нэг байртай тул автоматаар сонгогдоно)  2) мэдээлэл бөглөх  3) хянаж илгээх
 * Шинэ хүсэлтийн ноорог хөтөч дээр хадгалагдана (хуудас хаагдсан ч алдагдахгүй).
 */
import { h, $, $$, render, params } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { initPage } from '../core/layout.js';
import {
  toast, setBusy, clearErrors, showErrors, field, options, emptyState, loadingBlock, errorBlock, meter,
} from '../core/ui.js';
import { money, fmtPlainDate } from '../core/format.js';
import { rules, collectErrors } from '../core/rules.js';
import { dl } from '../core/application-view.js';

const REASON_MAX = 500;
const { user, meta } = await initPage({ role: 'student', active: 'apply', title: 'Хүсэлт' });
const wizard = $('#wizard');
const editId = params().get('id');
const DRAFT_KEY = `odb-draft-${user.id}`;

let dorms = [];
let step = 0;
let original = null; // засаж буй хүсэлт
const state = {
  dormId: '', phone: '', emergencyName: '', emergencyRelation: '', emergencyPhone: '',
  homeProvince: '', courseYear: '', priorityTags: [], reason: '',
};

// ---------------- Ноорог (зөвхөн шинэ хүсэлтэд) ----------------
function saveDraft() {
  if (editId) return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch (e) { /* хадгалж чадахгүй бол зүгээр */ }
}
function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      Object.keys(state).forEach((k) => { if (saved[k] !== undefined) state[k] = saved[k]; });
      return true;
    }
  } catch (e) { /* эвдэрсэн ноорог */ }
  return false;
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* зүгээр */ }
}

// ---------------- Алхам 1: байр ----------------
/** Хүсэлт авч буй ганц байр байвал оюутан сонгох шаардлагагүй */
const singleDorm = () => dorms.length === 1;

function dormStep() {
  if (singleDorm()) {
    const d = dorms[0];
    const full = d.available <= 0 && !(original && original.dormId === d.id);
    if (!full) state.dormId = String(d.id);
    return h('section', { class: 'panel panel-pad step-panel', dataset: { step: '0' } },
      h('h2', {}, 'Дотуур байр'),
      h('p', {}, 'Манай сургууль нэг дотуур байртай. Байрны мэдээлэл, сул орыг шалгаад үргэлжлүүлнэ үү.'),
      h('fieldset', { class: 'field', dataset: { field: 'dormId' } },
        h('legend', { class: 'sr-only' }, 'Байр'),
        h('div', { class: 'dorm-pick' },
          h('label', { class: 'dorm-option' },
            h('input', { type: 'radio', name: 'dormId', value: String(d.id), checked: !full, disabled: full }),
            h('div', { class: 'dorm-card' },
              h('h3', {}, d.name, h('span', { class: 'chip' }, d.genderLabel)),
              h('div', { class: 'fee' }, money(d.monthlyFee), h('small', {}, 'сард')),
              d.description ? h('p', { class: 'desc' }, d.description) : null,
              d.address ? h('p', { class: 'desc' }, d.address) : null,
              h('div', { class: 'occ' },
                meter(d.capacity, d.approved, 0),
                h('span', { class: 'num nowrap' }, full ? 'Дүүрсэн' : `${d.available} сул ор`))))),
        h('div', { class: 'field-error', 'aria-live': 'polite' }, full ? 'Байранд сул ор үлдээгүй байна' : '')),
      stepNav());
  }

  const cards = dorms.map((d) => {
    const isCurrent = original && original.dormId === d.id;
    const full = d.available <= 0 && !isCurrent;
    return h('label', { class: 'dorm-option' },
      h('input', {
        type: 'radio', name: 'dormId', value: String(d.id), checked: String(state.dormId) === String(d.id), disabled: full,
      }),
      h('div', { class: 'dorm-card' },
        h('h3', {}, d.name, h('span', { class: 'chip' }, d.genderLabel)),
        h('div', { class: 'fee' }, money(d.monthlyFee), h('small', {}, 'сард')),
        d.description ? h('p', { class: 'desc' }, d.description) : null,
        h('div', { class: 'occ' },
          meter(d.capacity, d.approved, 0),
          h('span', { class: 'num nowrap' }, full ? 'Дүүрсэн' : `${d.available} сул ор`))));
  });

  return h('section', { class: 'panel panel-pad step-panel', dataset: { step: '0' } },
    h('h2', {}, 'Байраа сонгоно уу'),
    h('p', {}, 'Таны хүйсэнд тохирох, хүсэлт хүлээн авч буй байрууд л харагдаж байна.'),
    h('fieldset', { class: 'field', dataset: { field: 'dormId' } },
      h('legend', { class: 'sr-only' }, 'Байр'),
      dorms.length ? h('div', { class: 'dorm-pick' }, cards)
        : emptyState({ iconName: 'building', title: 'Танд тохирох байр одоогоор алга', text: 'Дотуур байрны ажилтанд хандана уу.' }),
      h('div', { class: 'field-error', 'aria-live': 'polite' })),
    stepNav());
}

// ---------------- Алхам 2: мэдээлэл ----------------
function infoStep() {
  const reason = h('textarea', { class: 'textarea', maxlength: String(REASON_MAX), rows: 5, placeholder: 'Жишээ: Говь-Алтай аймгаас ирсэн, хотод хамаатан садангүй' });
  reason.value = state.reason;
  const counter = h('span', { class: 'num' }, `${state.reason.length}/${REASON_MAX}`);
  reason.addEventListener('input', () => { counter.textContent = `${reason.value.length}/${REASON_MAX}`; });

  const input = (name, attrs = {}) => {
    const el = h('input', { class: 'input', ...attrs });
    el.value = state[name] ?? '';
    return el;
  };
  const select = (name, pairs, placeholder) => h('select', { class: 'select' }, options(pairs, state[name], placeholder));

  const tags = Object.entries(meta.priorityTags).map(([value, label]) => h('label', { class: 'choice' },
    h('input', { type: 'checkbox', name: 'priorityTags', value, checked: state.priorityTags.includes(value) }),
    h('span', {}, label)));

  return h('section', { class: 'panel panel-pad step-panel', dataset: { step: '1' } },
    h('h2', {}, 'Мэдээллээ бөглөнө үү'),
    h('p', {}, 'Ажилтан энэ мэдээллээр тантай холбогдож, шийдвэр гаргана.'),
    h('div', { class: 'form' },
      h('h3', { class: 'section-title' }, 'Таны холбоо барих'),
      h('div', { class: 'form-row' },
        field({ label: 'Утасны дугаар', name: 'phone', input: input('phone', { type: 'tel', inputmode: 'numeric', maxlength: '8', autocomplete: 'tel', placeholder: '99112233' }) }),
        field({ label: 'Курс', name: 'courseYear', optional: true, input: select('courseYear', Object.entries(meta.courses), 'Сонгох') })),

      h('h3', { class: 'section-title mt-8' }, 'Яаралтай үед холбогдох хүн'),
      h('div', { class: 'form-row-3' },
        field({ label: 'Нэр', name: 'emergencyName', input: input('emergencyName', { type: 'text', maxlength: '60', placeholder: 'Ганбаатар Должин' }) }),
        field({ label: 'Таны хэн болох', name: 'emergencyRelation', optional: true, input: select('emergencyRelation', meta.relations.map((r) => [r, r]), 'Сонгох') }),
        field({ label: 'Утас', name: 'emergencyPhone', input: input('emergencyPhone', { type: 'tel', inputmode: 'numeric', maxlength: '8', placeholder: '88112233' }) })),

      h('h3', { class: 'section-title mt-8' }, 'Байранд суух шалтгаан'),
      field({ label: 'Аймаг, хот', name: 'homeProvince', optional: true, input: select('homeProvince', meta.provinces.map((p) => [p, p]), 'Хаанаас ирсэн бэ') }),
      h('fieldset', { class: 'field', dataset: { field: 'priorityTags' } },
        h('legend', { class: 'field-label' }, 'Давуу эрх ', h('span', { class: 'optional' }, '(заавал биш)')),
        h('div', { class: 'choices mt-8' }, tags),
        h('div', { class: 'hint' }, 'Хамаарах бүгдийг сонгоно уу. Шаардлагатай бол нотлох бичиг баримтаа ажилтанд үзүүлнэ.'),
        h('div', { class: 'field-error', 'aria-live': 'polite' })),
      h('div', { class: 'field', dataset: { field: 'reason' } },
        h('label', { for: 'f-reason' }, 'Яагаад байранд суух шаардлагатай вэ'),
        Object.assign(reason, { id: 'f-reason', name: 'reason' }),
        h('div', { class: 'hint hint-row' }, h('span', {}, 'Дор хаяж 10 тэмдэгт.'), counter),
        h('div', { class: 'field-error', 'aria-live': 'polite' }))),
    stepNav());
}

// ---------------- Алхам 3: хянах ----------------
function reviewStep() {
  return h('section', { class: 'panel panel-pad step-panel', dataset: { step: '2' } },
    h('h2', {}, 'Хянаад илгээнэ үү'),
    h('p', {}, editId ? 'Өөрчлөлтөө шалгаад хадгална уу.' : 'Илгээсний дараа шийдвэр гарах хүртэл засаж, цуцалж болно.'),
    h('div', { class: 'review', id: 'review' }),
    h('label', { class: 'confirm-line' },
      h('input', { type: 'checkbox', id: 'confirm' }),
      h('span', {}, 'Миний оруулсан мэдээлэл үнэн зөв болохыг баталж байна.')),
    h('div', { class: 'field-error', id: 'confirm-error', 'aria-live': 'polite' }),
    stepNav());
}

function renderReview() {
  const dorm = dorms.find((d) => String(d.id) === String(state.dormId));
  const block = (title, target, rows) => h('div', { class: 'review-block' },
    h('header', {}, h('h3', {}, title),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => go(target) }, icon('pencil', 'icon-sm'), 'Засах')),
    rows);
  render($('#review'),
    block('Байр', 0, dl([
      ['Байр', dorm ? `${dorm.name} (${dorm.genderLabel.toLowerCase()})` : '—'],
      ['Сарын төлбөр', dorm ? money(dorm.monthlyFee) : null],
      ['Хаяг', dorm ? dorm.address : null],
    ])),
    block('Холбоо барих', 1, dl([
      ['Утас', state.phone],
      ['Яаралтай үед', state.emergencyRelation ? `${state.emergencyName} (${state.emergencyRelation})` : state.emergencyName],
      ['Түүний утас', state.emergencyPhone],
    ])),
    block('Нэмэлт мэдээлэл', 1, h('div', {},
      dl([
        ['Аймаг, хот', state.homeProvince || null],
        ['Курс', state.courseYear ? meta.courses[state.courseYear] : null],
        ['Давуу эрх', state.priorityTags.length ? state.priorityTags.map((t) => meta.priorityTags[t]).join(', ') : 'Сонгоогүй'],
      ]),
      h('p', { class: 'quote mt-12' }, state.reason))));
}

// ---------------- Удирдлага ----------------
function stepNav() {
  const back = h('button', { class: 'btn btn-secondary', type: 'button', dataset: { nav: 'back' } }, icon('arrowLeft'), 'Буцах');
  const next = h('button', { class: 'btn', type: 'button', dataset: { nav: 'next' } }, 'Үргэлжлүүлэх', icon('chevronRight'));
  return h('div', { class: 'step-nav' }, back, next);
}

/** Form-оос state руу утга уншина */
function readForm() {
  const val = (name) => ($(`[name="${name}"]`, wizard)?.value ?? '').trim();
  state.dormId = $('[name="dormId"]:checked', wizard)?.value || '';
  state.phone = val('phone');
  state.emergencyName = val('emergencyName').replace(/\s+/g, ' ');
  state.emergencyRelation = val('emergencyRelation');
  state.emergencyPhone = val('emergencyPhone');
  state.homeProvince = val('homeProvince');
  state.courseYear = val('courseYear');
  state.priorityTags = $$('[name="priorityTags"]:checked', wizard).map((c) => c.value);
  state.reason = $('[name="reason"]', wizard)?.value.trim() ?? '';
}

function validateStep(index) {
  if (index === 0) {
    return collectErrors({ dormId: state.dormId ? null : 'Байраа сонгоно уу' });
  }
  if (index === 1) {
    return collectErrors({
      phone: rules.phone(state.phone),
      emergencyName: rules.name(state.emergencyName, 'Яаралтай үед холбогдох хүний нэрийг оруулна уу'),
      emergencyPhone: rules.phone(state.emergencyPhone, 'Яаралтай үед холбогдох утсыг оруулна уу')
        || (state.emergencyPhone === state.phone ? 'Өөрийн дугаараас өөр дугаар оруулна уу' : null),
      reason: rules.text(state.reason, { min: 10, max: REASON_MAX, label: 'Шалтгаан', empty: 'Байранд суух шалтгаанаа бичнэ үү' }),
    });
  }
  return null;
}

const STEP_OF_FIELD = { dormId: 0 };

function go(target) {
  readForm();
  saveDraft();
  step = target;
  $$('.step-panel', wizard).forEach((panel) => { panel.hidden = Number(panel.dataset.step) !== step; });
  $$('.steps li', wizard).forEach((li, i) => {
    li.classList.toggle('is-current', i === step);
    li.classList.toggle('is-done', i < step);
    if (i === step) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
  const panel = $(`.step-panel[data-step="${step}"]`, wizard);
  const back = $('[data-nav="back"]', panel);
  const next = $('[data-nav="next"]', panel);
  back.hidden = step === 0;
  if (step === 2) {
    renderReview();
    next.replaceChildren(icon(editId ? 'check' : 'send'), editId ? 'Өөрчлөлтийг хадгалах' : 'Хүсэлт илгээх');
  }
  $('h2', panel).setAttribute('tabindex', '-1');
  $('h2', panel).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submit(button) {
  const confirmBox = $('#confirm');
  const confirmError = $('#confirm-error');
  confirmError.textContent = '';
  if (!confirmBox.checked) {
    confirmError.textContent = 'Мэдээллээ шалгаад баталгаажуулна уу';
    confirmBox.focus();
    return;
  }
  const body = { ...state, courseYear: state.courseYear || null };
  setBusy(button, true);
  try {
    if (editId) await api.put(`/api/applications/${editId}`, body);
    else await api.post('/api/applications', body);
    clearDraft();
    window.location.href = editId ? '/dashboard.html?updated=1' : '/dashboard.html?submitted=1';
  } catch (err) {
    setBusy(button, false);
    if (err.details) {
      const first = Object.keys(err.details)[0];
      go(STEP_OF_FIELD[first] ?? 1);
      showErrors(wizard, err.details);
    }
    toast(err.message, 'error');
  }
}

wizard.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-nav]');
  if (!nav) return;
  if (nav.dataset.nav === 'back') { go(Math.max(step - 1, 0)); return; }
  readForm();
  clearErrors(wizard);
  const errors = validateStep(step);
  if (errors) { showErrors(wizard, errors); return; }
  if (step < 2) go(step + 1);
  else submit(nav);
});
wizard.addEventListener('input', () => { readForm(); saveDraft(); });
wizard.addEventListener('change', (e) => {
  if (e.target.name === 'dormId') clearErrors($('[data-step="0"]', wizard));
});

function blocked(title, text, action) {
  render(wizard, h('div', { class: 'panel' }, emptyState({ iconName: 'info', title, text, action })));
}

// ---------------- Эхлүүлэх ----------------
async function start() {
  render(wizard, loadingBlock());
  try {
    const [dormData, myData, profileData, editData] = await Promise.all([
      api.get('/api/dormitories'),
      api.get('/api/applications/my'),
      api.get('/api/profile'),
      editId ? api.get(`/api/applications/${encodeURIComponent(editId)}`) : null,
    ]);
    dorms = dormData.dormitories;
    const toDashboard = h('a', { class: 'btn', href: '/dashboard.html' }, 'Нүүр хуудас руу');

    if (editId) {
      original = editData.application;
      if (original.status !== 'PENDING') {
        blocked('Энэ хүсэлтийг засах боломжгүй', 'Зөвхөн хүлээгдэж буй хүсэлтийг засна.', toDashboard);
        return;
      }
      $('#title').textContent = `Хүсэлт №${original.id} засах`;
      $('#subtitle').textContent = 'Өөрчлөлтөө хийгээд хадгална уу.';
      Object.keys(state).forEach((k) => {
        if (original[k] !== undefined && original[k] !== null) state[k] = k === 'courseYear' ? String(original[k]) : original[k];
      });
    } else {
      const active = myData.applications.find((a) => a.academicYear === meta.window.academicYear && a.status !== 'CANCELLED');
      if (active) {
        blocked(`Та ${meta.window.academicYear} хичээлийн жилд хүсэлт илгээсэн байна`,
          'Хүсэлтийнхээ явцыг нүүр хуудаснаас харна. Хүлээгдэж буй хүсэлтээ тэндээс засаж болно.', toDashboard);
        return;
      }
      if (loadDraft()) toast('Өмнө бөглөж байсан ноорог тань сэргэлээ', 'info');
      if (!state.phone && profileData.profile.phone) state.phone = profileData.profile.phone;
    }

    if (!meta.window.open) {
      blocked('Хүсэлт хүлээн авахгүй байна', meta.window.message, toDashboard);
      return;
    }

    render(wizard,
      h('ol', { class: 'steps', 'aria-label': 'Алхамууд' },
        h('li', {}, singleDorm() ? 'Байр' : 'Байр сонгох'), h('li', {}, 'Мэдээлэл'), h('li', {}, 'Хянах')),
      meta.window.deadline ? h('div', { class: 'alert alert-info flash' }, icon('calendar'),
        h('div', {}, `Хүсэлтийг ${fmtPlainDate(meta.window.deadline)} хүртэл хүлээн авна.`)) : null,
      dormStep(), infoStep(), reviewStep());
    go(0);
    document.activeElement?.blur();
  } catch (err) {
    render(wizard, h('div', { class: 'panel' }, errorBlock(err.message, start)));
  }
}

start();
