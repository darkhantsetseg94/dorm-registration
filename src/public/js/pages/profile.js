import { h, $, $$, render } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage, setTheme } from '../core/layout.js';
import {
  toast, setBusy, clearErrors, showErrors, loadingBlock, errorBlock,
} from '../core/ui.js';
import { fmtDate, fmtDateTime, initials } from '../core/format.js';
import { rules, collectErrors } from '../core/rules.js';
import { dl } from '../core/application-view.js';

const { user } = await initPage({ role: 'any', active: 'profile', title: 'Профайл' });
const contactForm = $('#contact-form');
const passwordForm = $('#password-form');

function renderInfo(p) {
  render($('#profile-info'),
    h('div', { class: 'profile-head' },
      h('span', { class: 'avatar avatar-lg', 'aria-hidden': 'true' }, initials(p.fullName)),
      h('div', {}, h('h3', {}, p.fullName), h('p', { class: 'muted small' }, p.roleLabel))),
    h('div', { class: 'mt-16' }, dl([
      [p.role === 'student' ? 'Оюутны код' : 'Нэвтрэх нэр', p.username],
      ['Хүйс', p.genderLabel],
      ['Бүртгүүлсэн', fmtDate(p.createdAt)],
      ['Сүүлд нэвтэрсэн', p.lastLoginAt ? fmtDateTime(p.lastLoginAt) : null],
    ])),
    p.role === 'student' ? h('p', { class: 'hint mt-16' }, 'Нэр, оюутны код, хүйс буруу бол дотуур байрны ажилтанд хандана уу.') : null);
}

async function load() {
  render($('#profile-info'), loadingBlock());
  try {
    const { profile } = await api.get('/api/profile');
    renderInfo(profile);
    contactForm.email.value = profile.email;
    contactForm.phone.value = profile.phone || '';
  } catch (err) {
    render($('#profile-info'), errorBlock(err.message, load));
  }
}

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(contactForm);
  const body = { email: contactForm.email.value.trim(), phone: contactForm.phone.value.trim() };
  const errors = collectErrors({ email: rules.email(body.email), phone: body.phone ? rules.phone(body.phone) : null });
  if (errors) { showErrors(contactForm, errors); return; }
  const button = $('#contact-btn');
  setBusy(button, true);
  try {
    const data = await api.patch('/api/profile', body);
    toast(data.message);
  } catch (err) {
    if (err.details) showErrors(contactForm, err.details);
    else toast(err.message, 'error');
  } finally {
    setBusy(button, false);
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(passwordForm);
  const body = {
    currentPassword: passwordForm.currentPassword.value,
    newPassword: passwordForm.newPassword.value,
    newPasswordConfirm: passwordForm.newPasswordConfirm.value,
  };
  const errors = collectErrors({
    currentPassword: body.currentPassword ? null : 'Одоогийн нууц үгээ оруулна уу',
    newPassword: rules.password(body.newPassword),
    newPasswordConfirm: !rules.password(body.newPassword) && body.newPassword !== body.newPasswordConfirm ? 'Нууц үг таарахгүй байна' : null,
  });
  if (errors) { showErrors(passwordForm, errors); return; }
  const button = $('#password-btn');
  setBusy(button, true);
  try {
    const data = await api.post('/api/profile/password', body);
    passwordForm.reset();
    toast(data.message);
  } catch (err) {
    if (err.details) showErrors(passwordForm, err.details);
    else toast(err.message, 'error');
  } finally {
    setBusy(button, false);
  }
});

// Өнгөний горим
let saved = 'system';
try { saved = localStorage.getItem('odb-theme') || 'system'; } catch (e) { /* зүгээр */ }
$$('#theme-seg input').forEach((input) => {
  input.checked = input.value === saved;
  input.addEventListener('change', () => setTheme(input.value));
});

if (user.role === 'staff') document.title = 'Профайл — ОДБ ажилтан';
load();
