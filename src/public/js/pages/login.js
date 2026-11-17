import { h, $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { setBusy } from '../core/ui.js';
import { drawBuilding, passwordToggle, safeNext } from './auth-common.js';

const form = $('#login-form');
const errorBox = $('#login-error');
const button = $('#login-btn');

drawBuilding();
passwordToggle($('#toggle-password'), form.password);

function showError(message, type = 'error') {
  // textContent ашиглана — серверээс ирсэн текстийг HTML болгон тайлахгүй (XSS)
  errorBox.textContent = message;
  errorBox.className = `alert alert-${type}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.classList.add('hidden');
  const username = form.username.value.trim();
  const password = form.password.value;
  if (!username || !password) {
    showError('Нэвтрэх нэр болон нууц үгээ оруулна уу');
    (username ? form.password : form.username).focus();
    return;
  }

  setBusy(button, true);
  try {
    const data = await api.post('/api/auth/login', { username, password });
    const fallback = data.redirect || '/';
    // Оюутан ажилтны хуудас руу, эсвэл эсрэгээр шилжихгүй
    const next = safeNext(fallback);
    const allowed = data.user.role === 'staff' ? !['/dashboard.html', '/apply.html'].includes(next) : !next.startsWith('/admin');
    window.location.href = allowed ? next : fallback;
  } catch (err) {
    setBusy(button, false);
    showError(err.message);
    form.password.value = '';
    form.password.focus();
  }
});

// Бүртгэл нээлттэй эсэх, туршилтын бүртгэл
api.get('/api/meta').then((meta) => {
  $('#register-link').hidden = !meta.registrationOpen;
  if (meta.demoAccounts.length) {
    $('#demo-box').hidden = false;
    $('#demo-list').append(...meta.demoAccounts.map((a) => h('button', {
      class: 'btn btn-secondary btn-sm',
      type: 'button',
      onClick: () => { form.username.value = a.username; form.password.focus(); },
    }, h('strong', {}, a.username), h('span', { class: 'muted' }, a.label))));
  }
}).catch(() => {});

if (new URLSearchParams(window.location.search).has('next')) {
  showError('Үргэлжлүүлэхийн тулд системд нэвтэрнэ үү', 'info');
}
