const { getDb } = require("../lib/mongodb");

// Public projection — never send fileKey (private storage reference) to the browser.
const PUBLIC_FIELDS = {
  _id: 0,
  fileKey: 0,
  active: 0,
  createdAt: 0,
  updatedAt: 0,
};

// Handles both:
//   GET /api/books       -> list all active books
//   GET /api/books/:id   -> single book (rewritten to /api/books?id=:id, see vercel.json)
// Merged into one file so this stays ONE Vercel Function instead of two
// (Hobby plan caps a deployment at 12 Serverless Functions).
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { id } = req.query;

  try {
    const db = await getDb();

    if (id) {
      const book = await db
        .collection("books")
        .findOne({ id, active: true }, { projection: PUBLIC_FIELDS });

      if (!book) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      res.status(200).json(book);
      return;
    }

    const books = await db
      .collection("books")
      .find({ active: true }, { projection: PUBLIC_FIELDS })
      .sort({ createdAt: 1 })
      .toArray();

    res.status(200).json(books);
  } catch (err) {
    console.error("GET /api/books failed", err);
    res.status(500).json({ error: id ? "Could not load book" : "Could not load books" });
  }
};
