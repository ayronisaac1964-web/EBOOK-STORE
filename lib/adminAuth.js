// Single-admin auth. No user collection, no multi-role system — this is a
// one-author site. A correct ADMIN_PASSWORD gets you a signed, expiring
// session token (JWT-shaped: header.payload.signature, base64url, HMAC-SHA256).
// Not the `jsonwebtoken` package on purpose — one HMAC check is all this
// needs and it keeps the dependency list unchanged from earlier steps.
//
// Every admin endpoint MUST call requireAdmin(req, res) first and stop
// (return) if it returns null — that's what "no admin route reachable
// without authentication" means in practice.

const crypto = require("crypto");

const SECRET = process.env.ADMIN_SESSION_SECRET;
if (!SECRET) throw new Error("Missing ADMIN_SESSION_SECRET env var");

const TTL_HOURS = Number(process.env.ADMIN_SESSION_TTL_HOURS || 12);

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "ADMIN" }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

// Issues a fresh session token for the (single) admin.
function issueAdminToken() {
  const now = Date.now();
  const payload = {
    role: "admin",
    iat: now,
    exp: now + TTL_HOURS * 60 * 60 * 1000,
  };
  return { token: sign(payload), expiresAt: new Date(payload.exp).toISOString() };
}

// Returns the payload if the token is well-formed, correctly signed, and
// unexpired. Returns null for anything else — never throws.
function verifyAdminToken(token) {
  if (typeof token !== "string" || token.split(".").length !== 3) return null;
  const [header, body, signature] = token.split(".");

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  // Constant-time comparison — signature and expected are equal-length
  // base64url strings from the same HMAC, safe to compare as buffers.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || payload.role !== "admin" || typeof payload.exp !== "number") return null;
  if (Date.now() > payload.exp) return null;

  return payload;
}

// Timing-safe check of the login password against ADMIN_PASSWORD. Hashes
// both sides first so timingSafeEqual can compare equal-length buffers
// regardless of the raw password's length.
function isCorrectPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Call at the top of every admin handler. Reads "Authorization: Bearer
// <token>", sends 401 and returns null if missing/invalid so the caller
// can `if (!requireAdmin(req, res)) return;`.
function requireAdmin(req, res) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Admin session required" });
    return null;
  }
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ error: "Admin session invalid or expired" });
    return null;
  }
  return payload;
}

module.exports = { issueAdminToken, verifyAdminToken, isCorrectPassword, requireAdmin };
