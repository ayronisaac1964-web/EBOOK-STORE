// Paystack webhook. This is the SOURCE OF TRUTH for marking an order paid —
// unlike verify-transaction.js (frontend-triggered), this fires from
// Paystack's servers even if the buyer closes the tab, loses connection,
// or the frontend JS throws. Must read the RAW body to check the signature
// (bodyParser disabled below), and must respond 200 fast — Paystack retries
// on non-2xx / timeout.

const crypto = require("crypto");
const { fulfillOrder } = require("../lib/fulfill");

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  const raw = await readRawBody(req);

  const signature = req.headers["x-paystack-signature"];
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");

  if (!signature || signature !== expected) {
    // Not a genuine Paystack request — reject, don't process.
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  // Do the work BEFORE responding — serverless platforms can freeze/kill
  // the function the instant a response is sent, so "respond then work in
  // background" is not safe here like it might be on a long-running server.
  if (event.event === "charge.success") {
    const reference = event.data && event.data.reference;
    if (reference) {
      try {
        await fulfillOrder(reference);
      } catch (err) {
        console.error(`Webhook fulfillment failed for ${reference}`, err);
        // Fall through to 200 anyway — fulfillOrder is idempotent and will
        // be retried by the next webhook delivery or the frontend's
        // verify-transaction call. Returning 5xx here just makes Paystack
        // hammer retries for an error that likely needs a code fix, not a retry.
      }
    }
  }

  res.status(200).json({ received: true });
};
