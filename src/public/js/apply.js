const applyForm = document.getElementById('applyForm');
const applyAlert = document.getElementById('alert');
const FIELDS = ['phone', 'emergencyName', 'emergencyPhone', 'reason'];

// ?id=5 байвал засах горим (PATCH), үгүй бол шинэ хүсэлт (POST)
const editId = new URLSearchParams(window.location.search).get('id');
const isEdit = editId !== null && /^[1-9]\d{0,9}$/.test(editId);

/** Засах горимд одоогийн утгуудыг form-д бөглөнө. */
async function loadForEdit() {
  const { application } = await apiRequest(`/api/applications/${editId}`);
  if (application.status !== 'PENDING') {
    throw new Error(`Зөвхөн "Хүлээгдэж буй" хүсэлтийг засах боломжтой (одоо: ${application.statusLabel})`);
  }
  document.getElementById('pageTitle').textContent = `Хүсэлт #${application.id} засах`;
  document.getElementById('pageHint').textContent = 'Өөрчлөх талбаруудаа засаад «Хадгалах» товчийг дарна уу.';
  document.getElementById('submitBtn').textContent = 'Хадгалах';
  applyForm.phone.value = application.phone;
  applyForm.emergencyName.value = application.emergencyName;
  applyForm.emergencyPhone.value = application.emergencyPhone;
  applyForm.reason.value = application.reason;
}

function formData() {
  const data = {};
  FIELDS.forEach((f) => { data[f] = applyForm[f].value.trim(); });
  return data;
}

applyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(applyForm);
  showAlert(applyAlert, '');

  const button = document.getElementById('submitBtn');
  button.disabled = true;
  try {
    const result = isEdit
      ? await apiRequest(`/api/applications/${editId}`, { method: 'PATCH', body: formData() })
      : await apiRequest('/api/applications', { method: 'POST', body: formData() });
    try {
      sessionStorage.setItem('flash', `${result.message} (хүсэлт #${result.application.id})`);
    } catch (e) { /* sessionStorage ашиглах боломжгүй */ }
    window.location.href = '/dashboard.html';
  } catch (err) {
    if (err.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    showFieldErrors(applyForm, err.details);
    showAlert(applyAlert, err.message);
  } finally {
    button.disabled = false;
  }
});

(async () => {
  const user = await requireLogin();
  if (!user) return;
  if (user.role !== 'student') {
    window.location.href = '/dashboard.html';
    return;
  }
  if (!isEdit) return;
  try {
    await loadForEdit();
  } catch (err) {
    showAlert(applyAlert, err.message);
    applyForm.hidden = true;
  }
})();
