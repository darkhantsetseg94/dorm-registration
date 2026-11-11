const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('alert');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(loginForm);
  showAlert(loginAlert, '');

  const button = loginForm.querySelector('button');
  button.disabled = true;
  try {
    await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: loginForm.username.value.trim(),
        password: loginForm.password.value,
      },
    });
    window.location.href = '/dashboard.html';
  } catch (err) {
    showFieldErrors(loginForm, err.details);
    showAlert(loginAlert, err.message);
  } finally {
    button.disabled = false;
  }
});
