function cell(text) {
  const td = document.createElement('td');
  td.textContent = text; // XSS-ээс хамгаалж textContent ашиглана
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

function renderApplications(applications, message) {
  const rows = document.getElementById('applicationRows');
  rows.replaceChildren();

  if (applications.length === 0) {
    showAlert(document.getElementById('emptyState'), message || 'Илгээсэн хүсэлт байхгүй байна');
    document.getElementById('tableCard').hidden = true;
    return;
  }

  applications.forEach((app) => {
    const tr = document.createElement('tr');
    tr.append(
      cell(`#${app.id}`),
      cell(app.dormName),
      cell(app.academicYear),
      cell(formatDate(app.createdAt)),
      statusCell(app.status, app.statusLabel)
    );
    rows.appendChild(tr);
  });
  document.getElementById('tableCard').hidden = false;
}

async function initDashboard() {
  const user = await requireLogin();
  if (!user) return;

  // apply.html-ээс амжилттай илгээсний дараа ирсэн мэдэгдэл
  const flash = sessionStorage.getItem('flash');
  if (flash) {
    showAlert(document.getElementById('flash'), flash);
    sessionStorage.removeItem('flash');
  }

  if (user.role !== 'student') {
    document.getElementById('newApplication').hidden = true;
    document.getElementById('staffNote').hidden = false;
    return;
  }

  try {
    const { applications, message } = await apiRequest('/api/applications/my');
    renderApplications(applications, message);
  } catch (err) {
    showAlert(document.getElementById('emptyState'), err.message);
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login.html';
});

initDashboard();
