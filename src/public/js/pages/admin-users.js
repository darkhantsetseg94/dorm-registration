/**
 * Ажилтан: хэрэглэгч нэмэх, засах, идэвхгүй болгох, нууц үг шинэчлэх.
 */
import { h, $, render, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api, qs } from '../core/api.js';
import { initPage } from '../core/layout.js';
import {
  formModal, switchField, field, options, emptyState, loadingBlock, errorBlock,
} from '../core/ui.js';
import { fmtDate, timeAgo, initials } from '../core/format.js';

const { user: me } = await initPage({ role: 'staff', active: 'users', title: 'Хэрэглэгчид' });
const state = { q: '', role: '', page: 1 };
const ROLE_TABS = [['', 'Бүгд'], ['student', 'Оюутан'], ['staff', 'Ажилтан']];

$('.input-search').prepend(icon('search'));
$('#add-user').append(icon('plus'), 'Хэрэглэгч нэмэх');
$('#add-user').addEventListener('click', () => createForm());
$('#q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }, 300));

function renderTabs() {
  render($('#role-tabs'), ROLE_TABS.map(([value, label]) => h('button', {
    type: 'button', 'aria-pressed': String(state.role === value),
    onClick: () => { state.role = value; state.page = 1; renderTabs(); load(); },
  }, label)));
}

function renderTable(data) {
  if (data.users.length === 0) {
    render($('#table'), emptyState({ iconName: 'users', title: 'Хэрэглэгч олдсонгүй', text: 'Хайлтын үгээ өөрчилж үзнэ үү.' }));
    render($('#pager'));
    return;
  }
  render($('#table'), h('div', { class: 'table-wrap' }, h('table', { class: 'table table-cards' },
    h('thead', {}, h('tr', {}, ['Хэрэглэгч', 'Эрх', 'Имэйл', 'Утас', 'Сүүлд нэвтэрсэн', 'Төлөв', ''].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, data.users.map((u) => h('tr', {},
      h('td', { class: 'td-main' }, h('div', { class: 'profile-head' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(u.fullName)),
        h('div', { class: 'person' }, h('strong', {}, u.fullName), h('span', {}, `${u.username}, ${u.genderLabel.toLowerCase()}`)))),
      h('td', { 'data-label': 'Эрх' }, h('span', { class: u.role === 'staff' ? 'chip chip-lapis' : 'chip' }, u.roleLabel)),
      h('td', { 'data-label': 'Имэйл' }, u.email),
      h('td', { 'data-label': 'Утас' }, u.phone || '—'),
      h('td', { 'data-label': 'Сүүлд нэвтэрсэн', class: 'nowrap' }, u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Нэвтрээгүй'),
      h('td', { 'data-label': 'Төлөв' }, u.isActive
        ? h('span', { class: 'badge st-APPROVED' }, 'Идэвхтэй')
        : h('span', { class: 'badge st-CANCELLED' }, 'Идэвхгүй')),
      h('td', { class: 'right' }, h('div', { class: 'table-actions' },
        h('button', { class: 'icon-btn', type: 'button', title: 'Засах', 'aria-label': `${u.fullName} засах`, onClick: () => editForm(u) }, icon('pencil')),
        h('button', { class: 'icon-btn', type: 'button', title: 'Нууц үг шинэчлэх', 'aria-label': `${u.fullName}-ийн нууц үг шинэчлэх`, onClick: () => passwordForm(u) }, icon('lock'))))))))));

  const from = (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);
  render($('#pager'), h('div', { class: 'pager' },
    h('span', { class: 'num' }, `${data.total}-аас ${from}–${to}`),
    h('div', { class: 'pager-btns' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: data.page <= 1, onClick: () => { state.page -= 1; load(); } }, 'Өмнөх'),
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: data.page >= data.pages, onClick: () => { state.page += 1; load(); } }, 'Дараах'))));
}

async function load() {
  render($('#table'), loadingBlock());
  try {
    const data = await api.get(`/api/admin/users${qs(state)}`);
    state.page = data.page;
    renderTable(data);
  } catch (err) {
    render($('#table'), errorBlock(err.message, load));
  }
}

const input = (attrs, value = '') => Object.assign(h('input', { class: 'input', ...attrs }), { value: value ?? '' });
const genderSelect = (value = '') => h('select', { class: 'select' }, options([['male', 'Эрэгтэй'], ['female', 'Эмэгтэй']], value, 'Сонгох'));

function createForm() {
  const roleSelect = h('select', { class: 'select' }, options([['student', 'Оюутан'], ['staff', 'Ажилтан']], 'student'));
  const username = input({ maxlength: '20', autocomplete: 'off', placeholder: 'B221910001' });
  roleSelect.addEventListener('change', () => { username.placeholder = roleSelect.value === 'staff' ? 'staff02' : 'B221910001'; });
  formModal({
    title: 'Хэрэглэгч нэмэх',
    description: 'Хэрэглэгч нэвтрээд нууц үгээ профайлаасаа солих боломжтой.',
    fields: [
      h('div', { class: 'form-row' },
        field({ label: 'Эрх', name: 'role', input: roleSelect }),
        field({ label: 'Нэвтрэх нэр / оюутны код', name: 'username', input: username })),
      field({ label: 'Нэр, эцэг/эхийн нэр', name: 'fullName', input: input({ maxlength: '60' }) }),
      h('div', { class: 'form-row' },
        field({ label: 'Имэйл', name: 'email', input: input({ type: 'email', maxlength: '120' }) }),
        field({ label: 'Утас', name: 'phone', optional: true, input: input({ type: 'tel', maxlength: '8', inputmode: 'numeric' }) })),
      field({ label: 'Хүйс', name: 'gender', input: genderSelect() }),
      h('div', { class: 'form-row' },
        field({ label: 'Түр нууц үг', name: 'password', input: input({ type: 'text', maxlength: '128', autocomplete: 'new-password' }), hint: '8+ тэмдэгт, үсэг ба тоо' }),
        field({ label: 'Нууц үг давтах', name: 'passwordConfirm', input: input({ type: 'text', maxlength: '128', autocomplete: 'new-password' }) })),
    ],
    submitLabel: 'Хэрэглэгч нэмэх',
    async onSubmit(form) {
      const v = (n) => form.elements.namedItem(n).value.trim();
      const data = await api.post('/api/admin/users', {
        role: v('role'), username: v('username'), fullName: v('fullName'), email: v('email'), phone: v('phone'),
        gender: v('gender'), password: form.elements.namedItem('password').value, passwordConfirm: form.elements.namedItem('passwordConfirm').value,
      });
      load();
      return data.message;
    },
  });
}

function editForm(u) {
  const self = u.id === me.id;
  formModal({
    title: `${u.fullName} засах`,
    description: `${u.roleLabel}, ${u.username}. Бүртгүүлсэн: ${fmtDate(u.createdAt)}`,
    fields: [
      field({ label: 'Нэр, эцэг/эхийн нэр', name: 'fullName', input: input({ maxlength: '60' }, u.fullName) }),
      h('div', { class: 'form-row' },
        field({ label: 'Имэйл', name: 'email', input: input({ type: 'email', maxlength: '120' }, u.email) }),
        field({ label: 'Утас', name: 'phone', optional: true, input: input({ type: 'tel', maxlength: '8', inputmode: 'numeric' }, u.phone) })),
      field({ label: 'Хүйс', name: 'gender', input: genderSelect(u.gender), hint: u.role === 'student' ? 'Идэвхтэй хүсэлттэй оюутны хүйсийг өөрчлөх боломжгүй.' : null }),
      self ? h('p', { class: 'hint' }, 'Өөрийн бүртгэлийг идэвхгүй болгох боломжгүй.')
        : switchField({ name: 'isActive', label: 'Идэвхтэй', text: 'Унтраавал системд нэвтэрч чадахгүй, нэвтэрсэн бол шууд гарна.', checked: u.isActive }),
    ],
    async onSubmit(form) {
      const v = (n) => form.elements.namedItem(n).value.trim();
      const data = await api.put(`/api/admin/users/${u.id}`, {
        fullName: v('fullName'), email: v('email'), phone: v('phone'), gender: v('gender'),
        isActive: self ? true : form.elements.namedItem('isActive').checked,
      });
      load();
      return data.message;
    },
  });
}

function passwordForm(u) {
  formModal({
    title: 'Нууц үг шинэчлэх',
    description: `${u.fullName} (${u.username}). Шинэ нууц үгийг хэрэглэгчид өөрөө дамжуулна.`,
    fields: [
      field({ label: 'Шинэ нууц үг', name: 'password', input: input({ type: 'text', maxlength: '128', autocomplete: 'new-password' }), hint: '8+ тэмдэгт, үсэг ба тоо' }),
      field({ label: 'Давтах', name: 'passwordConfirm', input: input({ type: 'text', maxlength: '128', autocomplete: 'new-password' }) }),
    ],
    submitLabel: 'Нууц үг шинэчлэх',
    async onSubmit(form) {
      const data = await api.post(`/api/admin/users/${u.id}/password`, {
        password: form.elements.namedItem('password').value,
        passwordConfirm: form.elements.namedItem('passwordConfirm').value,
      });
      return data.message;
    },
  });
}

renderTabs();
load();
