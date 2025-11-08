// Helper functions
function showError(inputId, msg) {
  const input = document.getElementById(inputId);
  const errorSpan = input.parentElement.querySelector('.error-message');
  input.classList.add('input-invalid');
  errorSpan.textContent = msg;
  errorSpan.style.display = 'block';
}

function clearError(inputId) {
  const input = document.getElementById(inputId);
  const errorSpan = input.parentElement.querySelector('.error-message');
  input.classList.remove('input-invalid');
  errorSpan.textContent = '';
  errorSpan.style.display = 'none';
}

const forgotForm = document.getElementById('forgot-form');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('forgot-email').value.trim();
    const successDiv = document.getElementById('forgot-success');

    clearError('forgot-email');
    successDiv.style.display = 'none';
    successDiv.textContent = '';

    if (!email.includes('@')) {
      showError('forgot-email', 'Please enter a valid email address');
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:3000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (res.ok) {
        successDiv.textContent = '✔ Reset link sent! Check your email.';
        successDiv.style.display = 'block';
        successDiv.style.color = '#16a34a';
        successDiv.style.fontWeight = 'bold';

        forgotForm.reset();
      } else {
        showError('forgot-email', data.error || 'No account found with that email');
      }
    } catch (err) {
      showError('forgot-email', 'Server not reachable');
    }
  });
}
