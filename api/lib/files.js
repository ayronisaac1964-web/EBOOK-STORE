// Ebook files live in Cloudinary as "authenticated" delivery-type raw
// resources — never public. This mints a short-lived signed URL at the
// moment of a validated download, so the underlying file location is
// never exposed to the browser directly.

const cloudinary = require("cloudinary").v2;

function configured() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

// book.fileKey = the Cloudinary public_id of the raw uploaded ebook file
// (set by the admin panel in a later step), e.g. "ebooks/book-one.epub"
function getSignedDownloadUrl(fileKey, format) {
  const cld = configured();
  const expiresAt = Math.floor(Date.now() / 1000) + 60; // 60s to start the download
  return cld.utils.private_download_url(fileKey, format, {
    resource_type: "raw",
    type: "authenticated",
    expires_at: expiresAt,
  });
}

module.exports = { getSignedDownloadUrl };
