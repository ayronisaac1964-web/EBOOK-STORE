/* ============================================
   LOOKUP ORDER — recovery flow for buyers who lost their
   confirmation email
   ============================================

   REQUEST  POST /api/lookup-order
     { "email": "reader@example.com", "reference": "T123456789" }

   RESPONSE 200 (no match, or order not paid — generic on purpose)
     { "found": false }

   RESPONSE 200 (matched, paid, but every token expired/used up)
     { "found": true, "allExpired": true }

   RESPONSE 200 (matched, paid, usable downloads available)
     { "found": true, "items": [ { "title": "...", "downloadUrl": "..." } ] }

   RESPONSE 4xx/5xx
     { "error": "human-readable message" }
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("lookup-form").addEventListener("submit", handleSubmit);
});

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function handleSubmit(e) {
  e.preventDefault();

  const emailInput = document.getElementById("lookup-email");
  const referenceInput = document.getElementById("lookup-reference");
  const email = emailInput.value.trim();
  const reference = referenceInput.value.trim();

  const errorEl = document.getElementById("lookup-error");

  if (!isValidEmail(email) || reference === "") {
    emailInput.classList.toggle("input-invalid", !isValidEmail(email));
    referenceInput.classList.toggle("input-invalid", reference === "");
    errorEl.textContent = "Please enter both a valid email address and your order reference.";
    errorEl.hidden = false;
    return;
  }

  emailInput.classList.remove("input-invalid");
  referenceInput.classList.remove("input-invalid");
  errorEl.hidden = true;

  setResultState(null);
  const submitBtn = document.getElementById("lookup-submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Looking up your order…";

  try {
    const response = await fetch("/api/lookup-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reference }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Could not look up your order. Please try again.");
    }

    const data = await response.json();

    if (!data.found) {
      setResultState("not-found");
    } else if (data.allExpired) {
      setResultState("expired");
    } else {
      renderDownloads(data.items || []);
      setResultState("success");
    }
  } catch (err) {
    console.error("lookup-order failed", err);
    errorEl.textContent = err.message || "Something went wrong. Please try again.";
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Find my order";
  }
}

function renderDownloads(items) {
  const list = document.getElementById("lookup-download-list");
  list.innerHTML = items
    .map(
      ({ title, downloadUrl }) => `
        <li class="lookup-download-line">
          <span class="lookup-download-title">${escapeHtml(title)}</span>
          <a href="${downloadUrl}" class="btn btn-secondary">Download</a>
        </li>`
    )
    .join("");
}

// Toggles the not-found / expired / success panels. null hides all three.
function setResultState(state) {
  document.getElementById("result-not-found").hidden = state !== "not-found";
  document.getElementById("result-expired").hidden = state !== "expired";
  document.getElementById("result-success").hidden = state !== "success";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
