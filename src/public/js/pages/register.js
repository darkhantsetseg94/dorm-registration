import { $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { setBusy, clearErrors, showErrors } from '../core/ui.js';
import { rules, collectErrors } from '../core/rules.js';
import { drawBuilding, passwordToggle } from './auth-common.js';

const form = $('#register-form');
const alertBox = $('#form-alert');
const button = $('#submit-btn');

drawBuilding();
passwordToggle($('#toggle-password'), form.password);

function values() {
  return {
    username: form.username.value.trim().toUpperCase(),
    fullName: form.fullName.value.trim(),
    gender: form.gender.value,
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    password: form.password.value,
    passwordConfirm: form.passwordConfirm.value,
  };
}

// Серверийн дүрэмтэй ижил шалгалт (сервер эцсийн шийдвэр гаргана)
function validate(v) {
  return collectErrors({
    username: rules.studentCode(v.username),
    fullName: rules.name(v.fullName, 'Нэрээ оруулна уу'),
    gender: v.gender ? null : 'Хүйсээ сонгоно уу',
    email: rules.email(v.email),
    phone: v.phone ? rules.phone(v.phone) : null,
    password: rules.password(v.password),
    passwordConfirm: !rules.password(v.password) && v.password !== v.passwordConfirm ? 'Нууц үг таарахгүй байна' : null,
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  alertBox.classList.add('hidden');
  const v = values();
  const errors = validate(v);
  if (errors) {
    showErrors(form, errors);
    return;
  }

  setBusy(button, true);
  try {
    const data = await api.post('/api/auth/register', v);
    window.location.href = data.redirect || '/dashboard.html';
  } catch (err) {
    setBusy(button, false);
    if (err.details) showErrors(form, err.details);
    alertBox.textContent = err.message;
    alertBox.classList.remove('hidden');
  }
});

api.get('/api/meta').then((meta) => {
  if (!meta.registrationOpen) {
    form.hidden = true;
    const closed = $('#closed');
    closed.textContent = 'Шинээр бүртгүүлэх боломж одоогоор хаалттай байна. Дотуур байрны ажилтанд хандана уу.';
    closed.classList.remove('hidden');
  }
}).catch(() => {});
