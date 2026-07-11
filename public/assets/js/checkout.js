/* ============================================
   CHECKOUT — email capture + Paystack Popup (v2) trigger
   ============================================

   LIVE FLOW (tamper-resistant Paystack pattern, fully wired):
     1. Frontend POSTs email + cart contents (book ids + qty,
        NOT prices) to /api/create-transaction.
     2. Backend looks up authoritative prices server-side,
        calls Paystack's Initialize Transaction API with its
        SECRET key, and returns { reference, access_code }.
     3. Frontend calls the Popup v2 API's resumeTransaction(access_code)
        to open the popup for that already-initialized transaction.
        No public key needed client-side for this call — the
        access_code already ties the popup to the right amount.
     4. Paystack calls back into onSuccess() with a reference. That
        alone is never treated as proof of payment: onSuccess() calls
        /api/verify-transaction as a fast path, and Paystack's webhook
        (api/paystack-webhook.js) is the real, unspoofable source of
        truth that fulfills the order server-side either way.

   REQUEST  POST /api/create-transaction
     { "email": "reader@example.com",
       "items": [ { "bookId": "book-one", "quantity": 1 } ] }

   RESPONSE 200
     { "reference": "T123456789", "access_code": "0peioxfhpn" }

   RESPONSE 4xx/5xx
     { "error": "human-readable message" }
   ============================================ */

document.addEventListener("DOMContentLoaded", async () => {
  await window.BOOKS_READY; // BOOKS loads async from /api/books — see books-data.js
  const items = getCartDetails();
  const layout = document.getElementById("checkout-layout");
  const empty = document.getElementById("checkout-empty");

  if (items.length === 0) {
    layout.hidden = true;
    empty.hidden = false;
    return;
  }

  layout.hidden = false;
  empty.hidden = true;
  renderSummary(items);

  document.getElementById("pay-btn").addEventListener("click", handlePayClick);
});

function renderSummary(items) {
  const list = document.getElementById("checkout-summary-list");
  list.innerHTML = items
    .map(
      ({ book, quantity, lineTotal }) => `
        <li class="checkout-summary-line">
          <span>${book.title} &times; ${quantity}</span>
          <span>${formatPrice(lineTotal)}</span>
        </li>`
    )
    .join("");
  document.getElementById("checkout-summary-total").textContent = formatPrice(getCartTotal());
}

function isValidEmail(value) {
  // Simple, deliberately permissive check — real validation happens server-side too.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function handlePayClick() {
  const emailInput = document.getElementById("email-input");
  const email = emailInput.value.trim();

  if (!isValidEmail(email)) {
    emailInput.classList.add("input-invalid");
    document.getElementById("email-error").hidden = false;
    emailInput.focus();
    return;
  }

  emailInput.classList.remove("input-invalid");
  document.getElementById("email-error").hidden = true;

  initiatePaystackTransaction(email, getCartDetails());
}

async function initiatePaystackTransaction(email, items) {
  setStatus("processing");
  document.getElementById("pay-btn").disabled = true;

  try {
    // ---- INTEGRATION POINT — backend builder implements this endpoint ----
    // Send only ids + quantities. The backend must look up prices itself;
    // never trust an amount coming from the browser.
    const response = await fetch("/api/create-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        items: items.map(({ book, quantity }) => ({ bookId: book.id, quantity })),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Could not start payment. Please try again.");
    }

    const { reference, access_code } = await response.json();
    // ------------------------------------------------------------------

    openPaystackPopup({ reference, access_code, email });
  } catch (err) {
    console.error("create-transaction failed", err);
    setStatus("error", err.message);
    document.getElementById("pay-btn").disabled = false;
  }
}

function openPaystackPopup({ access_code, email }) {
  // Guard: if the Paystack script failed to load (offline, blocked, etc.)
  if (typeof PaystackPop === "undefined") {
    setStatus("error", "Payment provider failed to load. Check your connection and try again.");
    document.getElementById("pay-btn").disabled = false;
    return;
  }

  const popup = new PaystackPop();
  popup.resumeTransaction(access_code, {
    onSuccess: async (transaction) => {
      // Fast-path verification so the order is marked paid and the
      // confirmation email goes out without waiting on the webhook
      // round-trip. Paystack's webhook (server-side, api/paystack-webhook.js)
      // is the real source of truth and will fulfill the order even if this
      // call fails or the tab closes — fulfillOrder() is idempotent either way.
      try {
        await fetch(`/api/verify-transaction?reference=${encodeURIComponent(transaction.reference)}`);
      } catch (err) {
        console.warn("verify-transaction fast path failed, webhook will still fulfill", err);
      }
      setStatus("success", null, transaction.reference);
      clearCart();
    },
    onCancel: () => {
      // Buyer closed the popup — not an error, just back to idle.
      setStatus("idle");
      document.getElementById("pay-btn").disabled = false;
    },
    onError: (error) => {
      setStatus("error", "Payment failed. Please try again.");
      document.getElementById("pay-btn").disabled = false;
    },
  });
}

// Toggles the processing / error / success panels. "idle" hides all three.
function setStatus(state, message, reference) {
  const processing = document.getElementById("status-processing");
  const error = document.getElementById("status-error");
  const success = document.getElementById("status-success");

  processing.hidden = state !== "processing";
  error.hidden = state !== "error";
  success.hidden = state !== "success";

  if (state === "error" && message) {
    document.getElementById("status-error-text").textContent = message;
  }

  if (state === "success" && reference) {
    document.getElementById("order-reference-value").textContent = reference;
    wireCopyButton(reference);
  }
}

// Paystack references are long random strings — not something a buyer will
// reliably retype correctly by hand, so a working copy button is what
// actually makes the reference usable later on the lookup-order page.
function wireCopyButton(reference) {
  const copyBtn = document.getElementById("order-reference-copy-btn");
  const originalLabel = "Copy";

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      copyBtn.textContent = "Copied!";
    } catch (err) {
      console.warn("clipboard write failed", err);
      copyBtn.textContent = "Copy failed";
    }
    setTimeout(() => {
      copyBtn.textContent = originalLabel;
    }, 2000);
  };
}
