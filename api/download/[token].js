const { getDb } = require("../lib/mongodb");
const { getSignedDownloadUrl } = require("../lib/files");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).send("Missing token");
    return;
  }

  try {
    const db = await getDb();
    const tokenDoc = await db.collection("downloadTokens").findOne({ token });

    if (!tokenDoc) {
      res.status(404).send("This download link is invalid.");
      return;
    }
    if (tokenDoc.expiresAt && new Date(tokenDoc.expiresAt) < new Date()) {
      res.status(410).send("This download link has expired.");
      return;
    }
    if (tokenDoc.useCount >= tokenDoc.maxUses) {
      res.status(410).send("This download link has already been used the maximum number of times.");
      return;
    }

    const order = await db.collection("orders").findOne({ _id: tokenDoc.orderId });
    if (!order || order.status !== "paid") {
      res.status(403).send("This order is not marked as paid.");
      return;
    }

    const book = await db.collection("books").findOne({ id: tokenDoc.bookId });
    if (!book || !book.fileKey) {
      res.status(404).send("The ebook file could not be found.");
      return;
    }

    // Increment use count BEFORE redirecting — counts an issued redirect as
    // a use even if the buyer's download never completes client-side. This
    // errs toward protecting the file, not toward buyer convenience; if that
    // trade-off is wrong for this author, raise maxUses instead of removing this.
    await db
      .collection("downloadTokens")
      .updateOne({ token }, { $inc: { useCount: 1 } });

    const signedUrl = getSignedDownloadUrl(book.fileKey, book.fileFormat || "epub");
    res.writeHead(302, { Location: signedUrl });
    res.end();
  } catch (err) {
    console.error("GET /api/download/[token] failed", err);
    res.status(500).send("Something went wrong. Please try again.");
  }
};
