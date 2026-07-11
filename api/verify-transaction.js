// Frontend calls this right after PaystackPop's onSuccess fires, as a fast
// path so the buyer doesn't have to wait for the webhook round-trip. The
// webhook (api/paystack-webhook.js) is still the source of truth and will
// fulfill the order even if the buyer closes the tab before this call lands
// — fulfillOrder() is idempotent so whichever gets there first wins.

const { fulfillOrder } = require("./lib/fulfill");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { reference } = req.query;
  if (!reference || typeof reference !== "string") {
    res.status(400).json({ error: "Missing reference" });
    return;
  }

  try {
    const { order } = await fulfillOrder(reference);
    res.status(200).json({ status: order.status });
  } catch (err) {
    console.error("GET /api/verify-transaction failed", err);
    res.status(500).json({ error: "Could not verify payment" });
  }
};
