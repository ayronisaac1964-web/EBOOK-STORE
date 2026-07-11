if (requireAdminSession()) {
  loadOrders();
}

function formatNaira(kobo) {
  return "\u20A6" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function statusPillHtml(status) {
  const known = ["paid", "pending", "failed"];
  const cls = known.includes(status) ? status : "pending";
  return `<span class="status-pill ${cls}">${status}</span>`;
}

async function loadOrders() {
  const messageEl = document.getElementById("orders-message");
  try {
    const res = await adminFetch("/api/admin/orders");
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="admin-message error">${data.error || "Could not load orders"}</div>`;
      return;
    }

    const body = document.getElementById("orders-body");
    if (data.length === 0) {
      body.innerHTML = `<tr><td colspan="6">No orders yet.</td></tr>`;
      return;
    }

    body.innerHTML = data
      .map((o) => {
        const itemsSummary = (o.items || [])
          .map((it) => `${it.title} ×${it.quantity}`)
          .join(", ");
        return `
        <tr>
          <td>${o.email}</td>
          <td>${itemsSummary}</td>
          <td>${formatNaira(o.amountKobo)}</td>
          <td>${statusPillHtml(o.status)}</td>
          <td>${new Date(o.createdAt).toLocaleString("en-NG")}</td>
          <td style="font-family: monospace; font-size: 0.75rem;">${o.reference}</td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error("Could not load orders", err);
    messageEl.innerHTML = `<div class="admin-message error">Could not reach the server.</div>`;
  }
}
