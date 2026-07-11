const { Resend } = require("resend");

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY env var");
  return new Resend(key);
}

// items: [{ title, downloadUrl }]
async function sendOrderConfirmationEmail({ to, order, items }) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("Missing RESEND_FROM_EMAIL env var");

  const rows = items
    .map(
      (it) =>
        `<li style="margin-bottom:12px;"><strong>${escapeHtml(it.title)}</strong><br>
          <a href="${it.downloadUrl}">Download your ebook</a></li>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2>Thanks for your order!</h2>
      <p>Order reference: <strong>${escapeHtml(order.reference)}</strong></p>
      <p>Here ${items.length === 1 ? "is your download link" : "are your download links"}:</p>
      <ul style="list-style:none;padding:0;">${rows}</ul>
      <p style="color:#888;font-size:13px;">Download links expire after a set period and have a
      limited number of uses, so save the file once downloaded.</p>
    </div>`;

  await client().emails.send({
    from,
    to,
    subject: "Your ebook order is confirmed",
    html,
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

module.exports = { sendOrderConfirmationEmail };
