const { getDb } = require("../../lib/mongodb");
const { requireAdmin } = require("../../lib/adminAuth");

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

// Fields an admin is allowed to change on PATCH. `id` is immutable (order
// line items and download tokens reference books by this id — renaming it
// would orphan past orders). createdAt is immutable. `active` is included so
// a removed book can be restored from the Manage Books page; DELETE remains
// the normal path for removing one.
const EDITABLE_FIELDS = ["title", "description", "excerpt", "price", "cover", "fileKey", "fileFormat", "active"];

// Handles:
//   GET    /api/admin/books       -> list all books (admin view)
//   POST   /api/admin/books       -> create a book
//   PATCH  /api/admin/books/:id   -> update a book (rewritten to ?id=:id)
//   DELETE /api/admin/books/:id   -> soft-delete a book (rewritten to ?id=:id)
// Merged into one file so this stays ONE Vercel Function instead of two
// (Hobby plan caps a deployment at 12 Serverless Functions).
module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;
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
      const newId = await uniqueId(db, title);

      const doc = {
        id: newId,
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

  if (req.method === "PATCH") {
    if (!id) {
      res.status(400).json({ error: "Book id is required" });
      return;
    }

    const body = req.body || {};
    const update = {};

    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue;
      if (field === "price" && !(Number.isInteger(body.price) && body.price > 0)) {
        res.status(400).json({ error: "Price must be a positive whole number of Naira" });
        return;
      }
      if (field === "active" && typeof body.active !== "boolean") {
        res.status(400).json({ error: "active must be a boolean" });
        return;
      }
      update[field] = body[field];
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: "No editable fields provided" });
      return;
    }

    update.updatedAt = new Date();

    try {
      const result = await db
        .collection("books")
        .findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" });

      if (!result.value) {
        res.status(404).json({ error: "Book not found" });
        return;
      }
      res.status(200).json(result.value);
    } catch (err) {
      console.error("PATCH /api/admin/books/[id] failed", err);
      res.status(500).json({ error: "Could not update book" });
    }
    return;
  }

  if (req.method === "DELETE") {
    if (!id) {
      res.status(400).json({ error: "Book id is required" });
      return;
    }

    try {
      // Soft delete only — flips `active: false`. Past orders and
      // downloadTokens reference books by `id`, and /api/download/[token].js
      // looks the book up with no `active` filter, so existing purchasers
      // keep working. It just disappears from /api/books (public catalog).
      const result = await db
        .collection("books")
        .findOneAndUpdate(
          { id },
          { $set: { active: false, updatedAt: new Date() } },
          { returnDocument: "after" }
        );

      if (!result.value) {
        res.status(404).json({ error: "Book not found" });
        return;
      }
      res.status(200).json({ ok: true, book: result.value });
    } catch (err) {
      console.error("DELETE /api/admin/books/[id] failed", err);
      res.status(500).json({ error: "Could not remove book" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
