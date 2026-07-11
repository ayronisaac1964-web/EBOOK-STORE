const ADMIN_TOKEN_KEY = "admin_session_token";

// Already logged in with a live session? Skip straight to the dashboard.
if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
  window.location.href = "dashboard.html";
}

function showMessage(text, type) {
  const el = document.getElementById("login-message");
  el.innerHTML = text ? `<div class="admin-message ${type}">${text}</div>` : "";
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage("", "");

  const submitBtn = document.getElementById("login-submit");
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Login failed", "error");
      return;
    }

    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Admin login failed", err);
    showMessage("Could not reach the server. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});
