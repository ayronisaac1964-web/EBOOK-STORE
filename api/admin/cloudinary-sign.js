// Signs upload params so the admin browser can upload straight to Cloudinary
// without the file ever passing through a serverless function (avoids
// Vercel's request body size limit, which matters for ebook files) and
// without ever putting CLOUDINARY_API_SECRET in front-end code.
//
// Only two upload "kinds" are allowed, each with a fixed folder/type —
// the admin can't ask this endpoint to sign an arbitrary Cloudinary
// operation, just "cover" (public image) or "ebook" (private raw file).

const cloudinary = require("cloudinary").v2;
const { requireAdmin } = require("../../lib/adminAuth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const KIND_CONFIG = {
  // Book cover — public image, shown on the storefront.
  cover: { folder: "ebook-storefront/covers", resource_type: "image", type: "upload" },
  // Ebook file — private raw file, never publicly reachable. Matches the
  // `type: "authenticated"` assumption baked into lib/files.js.
  ebook: { folder: "ebook-storefront/ebooks", resource_type: "raw", type: "authenticated" },
};

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { kind } = req.body || {};
  const config = KIND_CONFIG[kind];
  if (!config) {
    res.status(400).json({ error: 'kind must be "cover" or "ebook"' });
    return;
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp, folder: config.folder, type: config.type };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder: config.folder,
      type: config.type,
      resourceType: config.resource_type,
    });
  } catch (err) {
    console.error("POST /api/admin/cloudinary-sign failed", err);
    res.status(500).json({ error: "Could not sign upload" });
  }
};
