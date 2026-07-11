// Single source of truth for "a payment came back successful — now what".
// Called from BOTH /api/verify-transaction (frontend polling fallback) and
// /api/paystack-webhook (the real source of truth). Idempotent: if the
// order is already marked paid, this is a no-op — safe to call twice for
// the same reference (webhook + manual verify racing each other).

const { getDb } = require("./mongodb");
const { verifyTransaction } = require("./paystack");
const { generateToken } = require("./tokens");
const { sendOrderConfirmationEmail } = require("./mailer");

const TOKEN_TTL_DAYS = Number(process.env.DOWNLOAD_TOKEN_TTL_DAYS || 30);
const TOKEN_MAX_USES = Number(process.env.DOWNLOAD_TOKEN_MAX_USES || 5);

// Shared shape used by both the confirmation email (right after payment)
// and the "Look Up My Order" recovery flow (api/lookup-order.js). Keeping
// this in one place means both surfaces build download links the same way.
function buildDownloadItems(order, tokenDocs) {
  const siteUrl = process.env.SITE_URL || "";
  return tokenDocs.map((t) => {
    const item = order.items.find((i) => i.bookId === t.bookId);
    return {
      title: item ? item.title : t.bookId,
      downloadUrl: `${siteUrl}/api/download/${t.token}`,
    };
  });
}

// Returns { alreadyFulfilled: bool, order } or throws.
async function fulfillOrder(reference) {
  const db = await getDb();
  const orders = db.collection("orders");

  const order = await orders.findOne({ reference });
  if (!order) throw new Error(`No order found for reference ${reference}`);

  if (order.status === "paid") {
    return { alreadyFulfilled: true, order };
  }

  // Ask Paystack directly — never trust the caller's word that it succeeded.
  const verified = await verifyTransaction(reference);

  if (verified.status !== "success") {
    await orders.updateOne(
      { reference },
      { $set: { status: "failed", paystackStatus: verified.status, updatedAt: new Date() } }
    );
    return { alreadyFulfilled: false, order: { ...order, status: "failed" } };
  }

  // Amount from Paystack must match what we charged for. Guards against a
  // tampered client-side flow slipping a different reference in.
  if (verified.amount !== order.amountKobo) {
    throw new Error(
      `Amount mismatch for ${reference}: paystack=${verified.amount} order=${order.amountKobo}`
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const downloadTokens = db.collection("downloadTokens");
  const tokenDocs = order.items.map((item) => ({
    token: generateToken(),
    orderId: order._id,
    reference,
    bookId: item.bookId,
    createdAt: now,
    expiresAt,
    maxUses: TOKEN_MAX_USES,
    useCount: 0,
  }));
  if (tokenDocs.length > 0) {
    await downloadTokens.insertMany(tokenDocs);
  }

  await orders.updateOne(
    { reference },
    { $set: { status: "paid", paystackStatus: "success", paidAt: now, updatedAt: now } }
  );

  const emailItems = buildDownloadItems(order, tokenDocs);

  await sendOrderConfirmationEmail({
    to: order.email,
    order,
    items: emailItems,
  });

  return { alreadyFulfilled: false, order: { ...order, status: "paid" } };
}

module.exports = { fulfillOrder, buildDownloadItems };
