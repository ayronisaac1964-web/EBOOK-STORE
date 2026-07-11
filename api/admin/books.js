const { getDb } = require("../lib/mongodb");
const { requireAdmin } = require("../lib/adminAuth");

function slugify(title) {
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function uniqueId(db, title) {
  const base = slugify(title) || "book";
  let candidate = base;
  let n = 1;
  // Small collection, a few extra queries on the rare collision is fine.
  while (await db.collection("books").findOne({ id: candidate })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();

  if (req.method === "GET") {
    try {
      // Full documents, INCLUDING inactive books and fileKey — this is the
      // admin's own view, unlike the public PUBLIC_FIELDS projection in
      // /api/books.js. Never expose this route's response to the public site.
      const books = await db.collection("books").find({}).sort({ createdAt: -1 }).toArray();
      res.status(200).json(books);
    } catch (err) {
      console.error("GET /api/admin/books failed", err);
      res.status(500).json({ error: "Could not load books" });
    }
    return;
  }

  if (req.method === "POST") {
    const { title, description, excerpt, price, cover, fileKey, fileFormat } = req.body || {};

    if (!isNonEmptyString(title)) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    if (!Number.isInteger(price) || price <= 0) {
      res.status(400).json({ error: "Price must be a positive whole number of Naira" });
      return;
    }
    if (!isNonEmptyString(fileKey)) {
      res.status(400).json({ error: "An uploaded ebook file is required" });
      return;
    }

    try {
      const now = new Date();
      const id = await uniqueId(db, title);

      const doc = {
        id,
        title: title.trim(),
        description: isNonEmptyString(description) ? description.trim() : "",
        excerpt: isNonEmptyString(excerpt) ? excerpt.trim() : undefined,
        price, // Naira, matches create-transaction.js's lineItems.unitPrice
        cover: isNonEmptyString(cover) ? cover : undefined, // Cloudinary secure_url (public)
        fileKey: fileKey.trim(), // Cloudinary public_id, authenticated/raw — never sent to /api/books
        fileFormat: isNonEmptyString(fileFormat) ? fileFormat.trim() : "epub",
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection("books").insertOne(doc);
      res.status(201).json(doc);
    } catch (err) {
      console.error("POST /api/admin/books failed", err);
      res.status(500).json({ error: "Could not create book" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
