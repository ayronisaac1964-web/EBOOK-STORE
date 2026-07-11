// Public, no-login recovery flow for buyers who never got (or lost) their
// confirmation email. Deliberately requires BOTH email AND reference —
// reference alone could be brute-forced (it's just a long random string,
// but a determined attacker could still hammer this endpoint), and email
// alone would let anyone check whether a given address has ever bought
// something here. Matching both together is what makes this safe without
// requiring buyers to create an account.
//
// ABUSE PROTECTION: there's no rate-limiting infrastructure anywhere else
// in this project to hook into, so none is wired up here. Repeated failed
// lookups from the same source is a brute-force signal worth watching —
// if this becomes a real target, the lightest fix is a per-IP or per-email
// attempt counter (in-memory Map with a TTL sweep works for a single warm
// lambda; a small `lookupAttempts` Mongo collection with a TTL index is the
// version that survives cold starts / multiple instances) that short-circuits
// with the same generic { found: false } once a threshold is hit in a
// rolling window. Deliberately not added here since it's not a one-line
// change and this is meant to be additive/minimal.

const { getDb } = require("../lib/mongodb");
const { buildDownloadItems } = require("../lib/fulfill");

// Same regex/logic as api/create-transaction.js's isValidEmail — kept as an
// identical local copy rather than a shared import so this endpoint stays
// fully self-contained and never risks changing create-transaction.js's
// behavior.
function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, reference } = req.body || {};

  if (!isValidEmail(email) || typeof reference !== "string" || reference.trim() === "") {
    res.status(400).json({ error: "A valid email and order reference are required" });
    return;
  }

  const normalizedEmail = email.trim();
  const normalizedReference = reference.trim();

  try {
    const db = await getDb();
    const order = await db.collection("orders").findOne({
      email: normalizedEmail,
      reference: normalizedReference,
    });

    // Generic, identical response whether the order doesn't exist, the
    // email/reference pairing doesn't match, or the order simply hasn't
    // been paid yet — never reveal which case it was.
    if (!order || order.status !== "paid") {
      res.status(200).json({ found: false });
      return;
    }

    const now = new Date();
    const allTokens = await db
      .collection("downloadTokens")
      .find({ reference: normalizedReference })
      .toArray();

    const usableTokens = allTokens.filter(
      (t) => (!t.expiresAt || new Date(t.expiresAt) >= now) && t.useCount < t.maxUses
    );

    if (usableTokens.length === 0) {
      res.status(200).json({ found: true, allExpired: true });
      return;
    }

    const items = buildDownloadItems(order, usableTokens);
    res.status(200).json({ found: true, items });
  } catch (err) {
    console.error("POST /api/lookup-order failed", err);
    res.status(500).json({ error: "Could not look up your order. Please try again." });
  }
};
