const { getDb } = require("../../lib/mongodb");
const { requireAdmin } = require("../../lib/adminAuth");

// Fields an admin is allowed to change. `id` is immutable (order line items
// and download tokens reference books by this id — renaming it would orphan
// past orders). createdAt is immutable. `active` is included so a removed
// book can be restored from the Manage Books page; DELETE remains the
// normal path for removing one.
const EDITABLE_FIELDS = ["title", "description", "excerpt", "price", "cover", "fileKey", "fileFormat", "active"];

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;
  const db = await getDb();

  if (req.method === "PATCH") {
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
