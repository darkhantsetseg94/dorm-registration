/* Бүх хуудсанд ашиглах нийтлэг функцууд */

/**
 * API руу JSON хүсэлт илгээнэ. Алдаатай бол { status, error, details }-тэй Error шиднэ.
 */
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }
  }
  if (!response.ok) {
    const err = new Error(data.error || 'Алдаа гарлаа');
    err.status = response.status;
    err.details = data.details || {};
    throw err;
  }
  return data;
}

/**
 * Нэвтэрсэн хэрэглэгчийг авна. Нэвтрээгүй бол login хуудас руу шилжүүлнэ.
 */
async function requireLogin() {
  try {
    const { user } = await apiRequest('/api/auth/me');
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = `${user.fullName} (${user.username})`;
    return user;
  } catch (e) {
    window.location.href = '/login.html';
    return null;
  }
}

/**
 * SQLite datetime('now') нь UTC цаг ("2026-10-22 04:05:26") хадгалдаг.
 * Хэрэглэгчийн орон нутгийн цаг (Улаанбаатар, UTC+8) руу хөрвүүлж харуулна.
 */
function formatDate(utcText) {
  const date = new Date(`${utcText.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return utcText;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function showAlert(el, message) {
  el.textContent = message; // textContent — XSS-ээс хамгаална
  el.hidden = !message;
}

function clearFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach((p) => { p.textContent = ''; });
  form.querySelectorAll('.invalid').forEach((i) => i.classList.remove('invalid'));
}

function showFieldErrors(form, details) {
  Object.entries(details || {}).forEach(([field, message]) => {
    const p = form.querySelector(`.field-error[data-for="${field}"]`);
    if (p) p.textContent = message;
    const input = form.querySelector(`[name="${field}"]`);
    if (input) input.classList.add('invalid');
  });
}
