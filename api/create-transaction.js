const { getDb } = require("../lib/mongodb");
const { initializeTransaction } = require("../lib/paystack");

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, items } = req.body || {};

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }
  for (const it of items) {
    if (!it || typeof it.bookId !== "string" || !Number.isInteger(it.quantity) || it.quantity < 1) {
      res.status(400).json({ error: "Invalid cart item" });
      return;
    }
  }

  try {
    const db = await getDb();
    const bookIds = items.map((it) => it.bookId);
    const books = await db
      .collection("books")
      .find({ id: { $in: bookIds }, active: true })
      .toArray();

    const bookMap = new Map(books.map((b) => [b.id, b]));

    // Authoritative line items — price comes ONLY from the database, never the request.
    const lineItems = [];
    for (const it of items) {
      const book = bookMap.get(it.bookId);
      if (!book) {
        res.status(400).json({ error: `Book "${it.bookId}" is unavailable` });
        return;
      }
      lineItems.push({
        bookId: book.id,
        title: book.title,
        unitPrice: book.price, // Naira
        quantity: it.quantity,
      });
    }

    const totalNaira = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
    const amountKobo = totalNaira * 100;

    // Reserve the order as "pending" BEFORE calling Paystack, so we already
    // have a record to reconcile against once the webhook/verify comes back.
    // We patch in the real reference right after Paystack returns it.
    const orders = db.collection("orders");
    const placeholderRef = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const insertResult = await orders.insertOne({
      reference: placeholderRef,
      email,
      items: lineItems,
      amountKobo,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let paystackData;
    try {
      paystackData = await initializeTransaction({
        email,
        amountKobo,
        metadata: { orderId: insertResult.insertedId.toString() },
      });
    } catch (err) {
      // Roll back the pending order if Paystack itself rejected the request.
      await orders.deleteOne({ _id: insertResult.insertedId });
      throw err;
    }

    await orders.updateOne(
      { _id: insertResult.insertedId },
      { $set: { reference: paystackData.reference, updatedAt: new Date() } }
    );

    res.status(200).json({
      reference: paystackData.reference,
      access_code: paystackData.access_code,
    });
  } catch (err) {
    console.error("POST /api/create-transaction failed", err);
    res.status(500).json({ error: "Could not start payment. Please try again." });
  }
};
