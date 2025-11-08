document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value.trim();
  const errorEl = document.getElementById("adminError");

  errorEl.textContent = "";

  try {
    const res = await fetch("http://127.0.0.1:3000/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok) {
      // ✅ Redirect to admin dashboard
      window.location.href = "/admin.html";
    } else {
      errorEl.textContent = data.error || "Invalid admin credentials";
    }
  } catch (err) {
    console.error("Admin login error:", err);
    errorEl.textContent = "Server error. Please try again.";
  }
});
