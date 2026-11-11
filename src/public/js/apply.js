const applyForm = document.getElementById('applyForm');
const applyAlert = document.getElementById('alert');

async function loadDormitories() {
  const select = document.getElementById('dormId');
  try {
    const { dormitories } = await apiRequest('/api/dormitories');
    dormitories.forEach((dorm) => {
      const option = document.createElement('option');
      option.value = String(dorm.id);
      option.textContent = dorm.genderType === 'mixed' ? `${dorm.name} (холимог)` : dorm.name;
      select.appendChild(option);
    });
  } catch (err) {
    showAlert(applyAlert, err.message);
  }
}

applyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(applyForm);
  showAlert(applyAlert, '');

  const button = applyForm.querySelector('button');
  button.disabled = true;
  try {
    const result = await apiRequest('/api/applications', {
      method: 'POST',
      body: {
        dormId: applyForm.dormId.value,
        phone: applyForm.phone.value.trim(),
        emergencyName: applyForm.emergencyName.value.trim(),
        emergencyPhone: applyForm.emergencyPhone.value.trim(),
        reason: applyForm.reason.value.trim(),
      },
    });
    sessionStorage.setItem('flash', `${result.message} (хүсэлт #${result.application.id})`);
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
  loadDormitories();
})();
