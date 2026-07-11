if (requireAdminSession()) {
  loadDashboard();
}

function formatNaira(kobo) {
  return "\u20A6" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function statusPillHtml(status) {
  const known = ["paid", "pending", "failed"];
  const cls = known.includes(status) ? status : "pending";
  return `<span class="status-pill ${cls}">${status}</span>`;
}

async function loadDashboard() {
  const messageEl = document.getElementById("dashboard-message");
  try {
    const res = await adminFetch("/api/admin/dashboard");
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="admin-message error">${data.error || "Could not load dashboard"}</div>`;
      return;
    }

    const statsEl = document.getElementById("admin-stats");
    statsEl.innerHTML = `
      <div class="admin-stat"><div class="value">${data.activeBooks}</div><div class="label">Active books</div></div>
      <div class="admin-stat"><div class="value">${data.totalBooks}</div><div class="label">Total books</div></div>
      <div class="admin-stat"><div class="value">${data.totalOrders}</div><div class="label">Total orders</div></div>
      <div class="admin-stat"><div class="value">${data.recentOrdersCount}</div><div class="label">Orders (7 days)</div></div>
      <div class="admin-stat"><div class="value">${formatNaira(data.totalRevenueKobo)}</div><div class="label">Revenue (paid)</div></div>
    `;

    const body = document.getElementById("recent-orders-body");
    if (data.recentOrders.length === 0) {
      body.innerHTML = `<tr><td colspan="5">No orders yet.</td></tr>`;
      return;
    }

    body.innerHTML = data.recentOrders
      .map(
        (o) => `
      <tr>
        <td>${o.email}</td>
        <td>${o.itemCount}</td>
        <td>${formatNaira(o.amountKobo)}</td>
        <td>${statusPillHtml(o.status)}</td>
        <td>${new Date(o.createdAt).toLocaleDateString("en-NG")}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Could not load dashboard", err);
    messageEl.innerHTML = `<div class="admin-message error">Could not reach the server.</div>`;
  }
}
