/**
 * Ажилтан: хүсэлт хүлээн авах хугацаа, бүртгэлийн тохиргоо.
 */
import { h, $, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { initPage } from '../core/layout.js';
import {
  toast, setBusy, clearErrors, showErrors, switchField,
} from '../core/ui.js';
import { fmtPlainDate, yearLabel } from '../core/format.js';

await initPage({ role: 'staff', active: 'settings', title: 'Тохиргоо' });
const form = $('#settings-form');

function renderStatus(win) {
  const text = win.open
    ? `${yearLabel(win.academicYear)} оны хүсэлтийг одоо хүлээн авч байна${win.deadline ? ` (${fmtPlainDate(win.deadline)} хүртэл)` : ''}.`
    : win.message;
  render($('#status'), h('div', { class: `alert ${win.open ? 'alert-ok' : 'alert-wait'}`, role: 'status' },
    icon(win.open ? 'check' : 'clock'), h('div', {}, h('strong', {}, 'Оюутнуудад одоо'), text)));
}

async function load() {
  try {
    const { settings, window: win } = await api.get('/api/admin/settings');
    render($('#open-switch'), switchField({ name: 'applicationsOpen', label: 'Хүсэлт хүлээн авна', checked: settings.applicationsOpen }));
    render($('#register-switch'), switchField({ name: 'registrationOpen', label: 'Бүртгэл нээлттэй', checked: settings.registrationOpen }));
    form.applicationStart.value = settings.applicationStart;
    form.applicationDeadline.value = settings.applicationDeadline;
    renderStatus(win);
  } catch (err) {
    toast(err.message, 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  const button = $('#save');
  setBusy(button, true);
  try {
    const data = await api.put('/api/admin/settings', {
      applicationsOpen: form.applicationsOpen.checked,
      registrationOpen: form.registrationOpen.checked,
      applicationStart: form.applicationStart.value,
      applicationDeadline: form.applicationDeadline.value,
    });
    renderStatus(data.window);
    toast(data.message);
  } catch (err) {
    if (err.details) showErrors(form, err.details);
    toast(err.message, 'error');
  } finally {
    setBusy(button, false);
  }
});

load();
