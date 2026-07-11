const { getDb } = require("../lib/mongodb");

const PUBLIC_FIELDS = { _id: 0, fileKey: 0, active: 0, createdAt: 0, updatedAt: 0 };

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { id } = req.query;

  try {
    const db = await getDb();
    const book = await db
      .collection("books")
      .findOne({ id, active: true }, { projection: PUBLIC_FIELDS });

    if (!book) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    res.status(200).json(book);
  } catch (err) {
    console.error("GET /api/books/[id] failed", err);
    res.status(500).json({ error: "Could not load book" });
  }
};
