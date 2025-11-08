// ===============================
// Helper Functions
// ===============================
function showError(inputId, msg) {
  const input = document.getElementById(inputId);
  const errorSpan = input.parentElement.querySelector('.error-message');
  errorSpan.textContent = msg;
  errorSpan.style.display = 'block';
  input.classList.add('input-invalid');
}

function clearError(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const errorSpan = input.parentElement.querySelector('.error-message');
  if (!errorSpan) return;
  errorSpan.textContent = '';
  errorSpan.style.display = 'none';
  input.classList.remove('input-invalid');
}


function parseTokenExpiry(expiresIn) {
  const value = parseInt(expiresIn);
  const unit = expiresIn.slice(-1);
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000; // default 15 minutes
  }
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ===============================
// SIGNUP HANDLER
// ===============================
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const successDiv = document.getElementById('signup-success');

    // Clear previous errors
    ['signup-username', 'signup-email', 'signup-password', 'signup-confirm'].forEach(clearError);

    // ✅ Frontend validation
    let valid = true;
    if (username.length < 6) {
      showError('signup-username', 'Username must be at least 6 characters long');
      valid = false;
    }
    if (!validateEmail(email)) {
      showError('signup-email', 'Please enter a valid email address');
      valid = false;
    }
    if (password.length < 6) {
      showError('signup-password', 'Password must be at least 6 characters');
      valid = false;
    }
    if (password !== confirm) {
      showError('signup-confirm', 'Passwords do not match');
      valid = false;
    }
    if (!valid) return;

    try {
      const res = await fetch('http://127.0.0.1:3000/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();
      if (res.ok) {
  successDiv.textContent = "✔ Signup successful!";
  successDiv.style.display = 'block';
  successDiv.style.color = '#16a34a';
  successDiv.style.fontWeight = 'bold';
  successDiv.style.marginBottom = '10px';
  successDiv.style.textAlign = 'center';

  // ✅ Wait 2 seconds, then switch back to login view
  setTimeout(() => {
    const container = document.querySelector('.container');
    container.classList.remove('active');  // show login form
    signupForm.reset();
    successDiv.style.display = 'none';
  }, 2000);
}
 else if (data.error) {
        if (data.error.includes('Email')) showError('signup-email', data.error);
        if (data.error.includes('Username')) showError('signup-username', data.error);
      }
    } catch (err) {
      console.error(err);
      showError('signup-email', 'Server not reachable');
    }
  });
}
// ===============================
// LOGIN HANDLER
// ===============================
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    // Clear errors and disable button
    ['login-username', 'login-password'].forEach(clearError);
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Logging in...';

    try {
      const res = await fetch('http://127.0.0.1:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        console.log("✅ Login successful:", {
          ...data,
          accessToken: data.accessToken ? '✓ present' : '❌ missing',
          refreshToken: data.refreshToken ? '✓ present' : '❌ missing',
          expiresIn: data.expiresIn ? '✓ present' : '❌ missing'
        });

        // ✅ Save tokens safely
        try {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);

          // Fallback expiry → 15 minutes from now if expiresIn missing
          const expiryMs = data.expiresIn
            ? Date.now() + parseTokenExpiry(data.expiresIn)
            : Date.now() + 15 * 60 * 1000;

          localStorage.setItem('tokenExpiry', expiryMs);

          console.log("✅ Tokens saved to localStorage:", {
            accessToken: !!localStorage.getItem('accessToken'),
            refreshToken: !!localStorage.getItem('refreshToken'),
            tokenExpiry: localStorage.getItem('tokenExpiry')
          });
        } catch (storageErr) {
          console.error("❌ Error saving tokens:", storageErr);
          showError('login-password', 'Failed to save authentication data');
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
          return;
        }

        // ✅ Success message + redirect
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.textContent = '✅ Login successful!';
        successMsg.style.color = '#16a34a';
        successMsg.style.fontWeight = 'bold';
        successMsg.style.marginBottom = '10px';
        successMsg.style.textAlign = 'center';
        loginForm.insertBefore(successMsg, loginForm.firstChild);

        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1000);
      } else {
        console.log("❌ Login failed:", data);
        showError('login-password', data.error || 'Invalid credentials');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }

    } catch (err) {
      console.error("❌ Server error:", err);
      showError('login-password', 'Server not reachable');
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
}

