const crypto = require("crypto");

// 32 bytes -> 43-char url-safe base64. Not guessable, no book/order id leaked.
function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

module.exports = { generateToken };
