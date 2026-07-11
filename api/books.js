const { getDb } = require("./lib/mongodb");

// Public projection — never send fileKey (private storage reference) to the browser.
const PUBLIC_FIELDS = {
  _id: 0,
  fileKey: 0,
  active: 0,
  createdAt: 0,
  updatedAt: 0,
};

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const db = await getDb();
    const books = await db
      .collection("books")
      .find({ active: true }, { projection: PUBLIC_FIELDS })
      .sort({ createdAt: 1 })
      .toArray();

    res.status(200).json(books);
  } catch (err) {
    console.error("GET /api/books failed", err);
    res.status(500).json({ error: "Could not load books" });
  }
};
