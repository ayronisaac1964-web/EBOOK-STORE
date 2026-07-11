if (requireAdminSession()) {
  // no initial data load needed on this page
}

function showFormMessage(text, type) {
  const el = document.getElementById("form-message");
  el.innerHTML = text ? `<div class="admin-message ${type}">${text}</div>` : "";
}

// Gets a signed upload target from our own backend (never exposes
// CLOUDINARY_API_SECRET), then uploads the file straight to Cloudinary from
// the browser — the file never passes through our serverless function.
async function uploadToCloudinary(file, kind, statusElId) {
  const statusEl = document.getElementById(statusElId);
  statusEl.textContent = "Requesting upload permission…";

  const signRes = await adminFetch("/api/admin/cloudinary-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  const sign = await signRes.json();
  if (!signRes.ok) throw new Error(sign.error || "Could not prepare upload");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sign.apiKey);
  formData.append("timestamp", sign.timestamp);
  formData.append("signature", sign.signature);
  formData.append("folder", sign.folder);
  formData.append("type", sign.type);

  statusEl.textContent = "Uploading…";
  const uploadUrl = `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`;
  const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
  const uploaded = await uploadRes.json();

  if (!uploadRes.ok) {
    throw new Error(uploaded.error ? uploaded.error.message : "Upload failed");
  }

  statusEl.textContent = "Uploaded ✓";
  return uploaded;
}

document.getElementById("add-book-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormMessage("", "");

  const submitBtn = document.getElementById("submit-btn");
  const coverFile = document.getElementById("cover-file").files[0];
  const ebookFile = document.getElementById("ebook-file").files[0];

  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading…";

  try {
    const [coverUpload, ebookUpload] = await Promise.all([
      uploadToCloudinary(coverFile, "cover", "cover-status"),
      uploadToCloudinary(ebookFile, "ebook", "ebook-status"),
    ]);

    const price = Number(document.getElementById("price").value);

    const res = await adminFetch("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: document.getElementById("title").value,
        description: document.getElementById("description").value,
        excerpt: document.getElementById("excerpt").value,
        price,
        cover: coverUpload.secure_url,
        fileKey: ebookUpload.public_id,
        fileFormat: ebookUpload.format,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showFormMessage(data.error || "Could not add book", "error");
      return;
    }

    showFormMessage(`"${data.title}" was added.`, "success");
    document.getElementById("add-book-form").reset();
    document.getElementById("cover-status").textContent = "";
    document.getElementById("ebook-status").textContent = "";
  } catch (err) {
    console.error("Add book failed", err);
    showFormMessage(err.message || "Something went wrong.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add Book";
  }
});
