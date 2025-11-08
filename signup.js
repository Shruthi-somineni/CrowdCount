const form = document.getElementById('signupForm');
const usernameInput = document.getElementById('username');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

const usernameError = document.getElementById('username-error');
const firstNameError = document.getElementById('firstName-error');
const lastNameError = document.getElementById('lastName-error');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const confirmPasswordError = document.getElementById('confirmPassword-error');

function showError(input, errorEl, msg) {
  input.classList.add('input-invalid');
  input.setAttribute('aria-invalid', 'true');
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function clearError(input, errorEl) {
  input.classList.remove('input-invalid');
  input.setAttribute('aria-invalid', 'false');
  errorEl.textContent = '';
  errorEl.hidden = true;
}

// Clear error when user types
[usernameInput, firstNameInput, lastNameInput, emailInput, passwordInput, confirmPasswordInput].forEach(i =>
  i.addEventListener('input', () => clearError(i, document.getElementById(i.id + '-error')))
);

form.addEventListener('submit', async e => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  let firstInvalid = null;
  if (!username) { showError(usernameInput, usernameError, 'Choose username'); firstInvalid = firstInvalid || usernameInput; }
  if (!firstName) { showError(firstNameInput, firstNameError, 'Enter first name'); firstInvalid = firstInvalid || firstNameInput; }
  if (!lastName) { showError(lastNameInput, lastNameError, 'Enter last name'); firstInvalid = firstInvalid || lastNameInput; }
  if (!email || !email.includes('@')) { showError(emailInput, emailError, 'Enter valid email'); firstInvalid = firstInvalid || emailInput; }
  if (!password || password.length < 6) { showError(passwordInput, passwordError, 'Password must be at least 6 chars'); firstInvalid = firstInvalid || passwordInput; }
  if (password !== confirmPassword) { showError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match'); firstInvalid = firstInvalid || confirmPasswordInput; }

  if (firstInvalid) { firstInvalid.focus(); return; }

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    const res = await fetch('http://127.0.0.1:3000/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        name: firstName + ' ' + lastName,
        email,
        password
      })
    });
    const body = await res.json();

    submitBtn.disabled = false;
    submitBtn.textContent = originalText;

    if (!res.ok) {
      // Show the correct field error based on backend response
      if (body.field === "username") {
        showError(usernameInput, usernameError, body.error);
      } else if (body.field === "email") {
        showError(emailInput, emailError, body.error);
      } else {
        showError(passwordInput, passwordError, body.error || 'Signup failed');
      }
      return;
    }

    // Success
    const successDiv = document.getElementById('signup-success');
    successDiv.innerHTML = '✔ Signup successful';
    successDiv.style.display = 'block';
    successDiv.style.color = '#16a34a';
    successDiv.style.fontSize = '18px';
    successDiv.style.textAlign = 'center';
    successDiv.style.marginBottom = '16px';

    // Disable all inputs
    form.querySelectorAll('input, button').forEach(el => el.disabled = true);

    setTimeout(() => window.location.href = 'login.html', 2000);

  } catch (err) {
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    showError(passwordInput, passwordError, 'Server not reachable');
  }
});




