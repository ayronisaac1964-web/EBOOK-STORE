const { getDb } = require("../../lib/mongodb");
const { requireAdmin } = require("../../lib/adminAuth");

const MAX_LIMIT = 100;

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const limitParam = Number(req.query.limit);
  const limit = Number.isInteger(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : 50;

  try {
    const db = await getDb();
    const orders = await db
      .collection("orders")
      .find(
        {},
        {
          projection: {
            reference: 1,
            email: 1,
            items: 1,
            amountKobo: 1,
            status: 1,
            paystackStatus: 1,
            createdAt: 1,
            paidAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.status(200).json(
      orders.map((o) => ({
        id: o._id.toString(),
        reference: o.reference,
        email: o.email,
        items: o.items,
        amountKobo: o.amountKobo,
        status: o.status,
        paystackStatus: o.paystackStatus || null,
        createdAt: o.createdAt,
        paidAt: o.paidAt || null,
      }))
    );
  } catch (err) {
    console.error("GET /api/admin/orders failed", err);
    res.status(500).json({ error: "Could not load orders" });
  }
};
