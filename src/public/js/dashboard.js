const errorBox = document.getElementById('error');
const flashBox = document.getElementById('flash');

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text == null ? '' : text; // XSS-ээс хамгаалж textContent ашиглана
  return td;
}

function wrapCell(text) {
  const td = cell(text);
  td.className = 'wrap';
  return td;
}

function statusCell(status, label) {
  const td = document.createElement('td');
  const span = document.createElement('span');
  span.className = `badge badge-${status}`;
  span.textContent = label;
  td.appendChild(span);
  return td;
}

function button(text, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn btn-sm ${className}`;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function flash(message) {
  showAlert(errorBox, '');
  showAlert(flashBox, message);
}

/* ---------------- Оюутан ---------------- */

async function cancelApplication(app) {
  if (!window.confirm(`#${app.id} хүсэлтээ цуцлах уу? Цуцалсны дараа дахин шинээр илгээх боломжтой.`)) return;
  try {
    await apiRequest(`/api/applications/${app.id}`, { method: 'DELETE' });
    flash(`Хүсэлт #${app.id} цуцлагдлаа`);
    loadStudent();
  } catch (err) {
    showAlert(errorBox, err.message);
  }
}

function renderStudent(applications, message) {
  const rows = document.getElementById('applicationRows');
  rows.replaceChildren();

  if (applications.length === 0) {
    showAlert(document.getElementById('emptyState'), message || 'Илгээсэн хүсэлт байхгүй байна');
    document.getElementById('tableCard').hidden = true;
    return;
  }
  document.getElementById('emptyState').hidden = true;

  applications.forEach((app) => {
    const tr = document.createElement('tr');
    const actions = document.createElement('td');
    if (app.status === 'PENDING') {
      const edit = document.createElement('a');
      edit.className = 'btn btn-sm btn-outline';
      edit.href = `/apply.html?id=${encodeURIComponent(app.id)}`;
      edit.textContent = 'Засах';
      actions.append(edit, button('Цуцлах', 'btn-danger', () => cancelApplication(app)));
    }
    tr.append(
      cell(`#${app.id}`),
      cell(app.dormName),
      cell(app.academicYear),
      cell(formatDate(app.createdAt)),
      statusCell(app.status, app.statusLabel),
      wrapCell(app.reviewNote || ''),
      actions
    );
    rows.appendChild(tr);
  });
  document.getElementById('tableCard').hidden = false;
}

async function loadStudent() {
  try {
    const { applications, message } = await apiRequest('/api/applications/my');
    renderStudent(applications, message);
  } catch (err) {
    showAlert(errorBox, err.message);
  }
}

/* ---------------- Ажилтан ---------------- */

async function review(app, status) {
  const body = { status };
  if (status === 'REJECTED') {
    const note = window.prompt(`#${app.id} (${app.studentName}) хүсэлтийг татгалзах шалтгаан:`);
    if (note === null) return;
    body.reviewNote = note;
  }
  try {
    const result = await apiRequest(`/api/applications/${app.id}`, { method: 'PATCH', body });
    flash(`#${app.id}: ${result.message}`);
    loadStaff();
  } catch (err) {
    const details = Object.values(err.details || {}).join(' ');
    showAlert(errorBox, details ? `${err.message}: ${details}` : err.message);
  }
}

function renderStaff(applications) {
  const rows = document.getElementById('staffRows');
  rows.replaceChildren();
  document.getElementById('staffEmpty').hidden = applications.length > 0;
  document.getElementById('staffTableCard').hidden = applications.length === 0;

  applications.forEach((app) => {
    const tr = document.createElement('tr');
    const actions = document.createElement('td');
    if (app.status === 'PENDING') {
      actions.append(
        button('Зөвшөөрөх', 'btn-success', () => review(app, 'APPROVED')),
        button('Татгалзах', 'btn-danger', () => review(app, 'REJECTED'))
      );
    } else if (app.reviewNote) {
      actions.className = 'wrap muted';
      actions.textContent = app.reviewNote;
    }
    tr.append(
      cell(`#${app.id}`),
      cell(`${app.studentName} (${app.studentUsername})`),
      cell(app.dormName),
      cell(app.phone),
      wrapCell(app.reason),
      cell(formatDate(app.createdAt)),
      statusCell(app.status, app.statusLabel),
      actions
    );
    rows.appendChild(tr);
  });
}

async function loadStaff() {
  const status = document.getElementById('statusFilter').value;
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const { applications } = await apiRequest(`/api/applications${query}`);
    renderStaff(applications);
  } catch (err) {
    showAlert(errorBox, err.message);
  }
}

/* ---------------- Эхлэл ---------------- */

async function initDashboard() {
  const user = await requireLogin();
  if (!user) return;

  // apply.html-ээс ирсэн мэдэгдэл
  let flashMessage = null;
  try {
    flashMessage = sessionStorage.getItem('flash');
    sessionStorage.removeItem('flash');
  } catch (e) { /* sessionStorage ашиглах боломжгүй */ }
  if (flashMessage) showAlert(flashBox, flashMessage);

  if (user.role === 'staff') {
    document.getElementById('staffSection').hidden = false;
    document.getElementById('statusFilter').addEventListener('change', loadStaff);
    loadStaff();
  } else {
    document.getElementById('studentSection').hidden = false;
    loadStudent();
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login.html';
});

initDashboard();
