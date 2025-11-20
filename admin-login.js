document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value.trim();
  const errorEl = document.getElementById("adminError");

  errorEl.textContent = "";

  // ✅ Frontend validation for password length
  if (password.length < 6) {
    errorEl.textContent = "Password must be at least 6 characters long";
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:3000/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    // ✅ Handle success
    if (res.ok) {
      // Save both tokens to localStorage
      if (data.accessToken) {
        localStorage.setItem("adminToken", data.accessToken);
        localStorage.setItem("adminAccessToken", data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem("adminRefreshToken", data.refreshToken);
      }
      
      console.log('✅ Admin tokens saved to localStorage');

      // ✅ Redirect to the admin dashboard immediately
      window.location.href = "admin-dashboard.html";
    } 
    // ❌ Handle errors
    else {
      errorEl.textContent = data.error || "Invalid admin credentials";
    }
  } catch (err) {
    console.error("Admin login error:", err);
    errorEl.textContent = "Server error. Please try again.";
  }
});

