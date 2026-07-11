/* ============================================
   ADMIN AUTH — shared by every /admin page except login.html.
   Loaded right after main.js on every admin page.
   ============================================ */

const ADMIN_TOKEN_KEY = "admin_session_token";

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

// Every admin page (other than login.html) calls this immediately. Bounces
// to login.html with no token = no page render, not just no data.
function requireAdminSession() {
  if (!getAdminToken()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// fetch() wrapper that attaches the admin bearer token and sends the caller
// straight back to login.html on a 401 (expired/invalid session) instead of
// leaving the page silently broken.
async function adminFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers, {
    Authorization: `Bearer ${getAdminToken()}`,
  });
  const res = await fetch(path, Object.assign({}, options, { headers }));

  if (res.status === 401) {
    clearAdminToken();
    window.location.href = "login.html";
    throw new Error("Admin session expired");
  }
  return res;
}

function wireAdminLogout() {
  const btn = document.getElementById("admin-logout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    clearAdminToken();
    window.location.href = "login.html";
  });
}

document.addEventListener("DOMContentLoaded", wireAdminLogout);
