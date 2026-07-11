const { isCorrectPassword, issueAdminToken } = require("../../lib/adminAuth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password } = req.body || {};

  if (!isCorrectPassword(password)) {
    // Same message either way — don't reveal whether the field itself was missing.
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const { token, expiresAt } = issueAdminToken();
  res.status(200).json({ token, expiresAt });
};
