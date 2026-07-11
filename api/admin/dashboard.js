const { getDb } = require("../lib/mongodb");
const { requireAdmin } = require("../lib/adminAuth");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const db = await getDb();
    const books = db.collection("books");
    const orders = db.collection("orders");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalBooks, activeBooks, totalOrders, recentOrdersCount, paidOrders, recentOrders] =
      await Promise.all([
        books.countDocuments({}),
        books.countDocuments({ active: true }),
        orders.countDocuments({}),
        orders.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        orders.find({ status: "paid" }).project({ amountKobo: 1 }).toArray(),
        orders
          .find({}, { projection: { email: 1, items: 1, amountKobo: 1, status: 1, createdAt: 1 } })
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray(),
      ]);

    const totalRevenueKobo = paidOrders.reduce((sum, o) => sum + (o.amountKobo || 0), 0);

    res.status(200).json({
      totalBooks,
      activeBooks,
      totalOrders,
      recentOrdersCount, // last 7 days
      totalRevenueKobo, // sum of amountKobo across paid orders
      recentOrders: recentOrders.map((o) => ({
        id: o._id.toString(),
        email: o.email,
        itemCount: (o.items || []).length,
        amountKobo: o.amountKobo,
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/dashboard failed", err);
    res.status(500).json({ error: "Could not load dashboard" });
  }
};
