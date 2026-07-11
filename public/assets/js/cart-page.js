// Cart page — renders line items from getCartDetails() (assets/js/cart.js)
// and wires up quantity +/- and remove. Re-renders on every "cart:updated"
// event so the UI never goes stale, including when changes happen on this
// same page.

document.addEventListener("DOMContentLoaded", async () => {
  await window.BOOKS_READY; // BOOKS loads async from /api/books — see books-data.js
  renderCart();
});
window.addEventListener("cart:updated", renderCart);

function renderCart() {
  const items = getCartDetails();
  const layout = document.getElementById("cart-layout");
  const empty = document.getElementById("cart-empty");

  if (items.length === 0) {
    layout.hidden = true;
    empty.hidden = false;
    return;
  }

  layout.hidden = false;
  empty.hidden = true;

  document.getElementById("cart-list").innerHTML = items.map(cartLineTemplate).join("");
  document.getElementById("cart-summary-count").textContent = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  document.getElementById("cart-summary-total").textContent = formatPrice(getCartTotal());
}

function cartLineTemplate({ book, quantity, lineTotal }) {
  const coverInner = book.cover
    ? `<img src="${book.cover}" alt="${book.title} cover">`
    : `<span>Cover</span>`;

  return `
    <li class="cart-line" data-book-id="${book.id}">
      <div class="cart-line-cover placeholder">${coverInner}</div>

      <div class="cart-line-body">
        <p class="cart-line-title">${book.title}</p>
        <p class="cart-line-price">${formatPrice(book.price)} each</p>
      </div>

      <div class="cart-line-qty">
        <button class="qty-btn qty-decrease" aria-label="Decrease quantity">&minus;</button>
        <span class="qty-value">${quantity}</span>
        <button class="qty-btn qty-increase" aria-label="Increase quantity">&plus;</button>
      </div>

      <p class="cart-line-total">${formatPrice(lineTotal)}</p>

      <button class="cart-line-remove" aria-label="Remove ${book.title} from cart">Remove</button>
    </li>
  `;
}

// One delegated listener on the list handles every line's buttons, including
// lines re-rendered after a quantity change.
document.addEventListener("click", (e) => {
  const line = e.target.closest(".cart-line");
  if (!line) return;
  const bookId = line.dataset.bookId;

  if (e.target.closest(".qty-increase")) {
    addToCart(bookId, 1);
  } else if (e.target.closest(".qty-decrease")) {
    const current = getCart()[bookId] || 0;
    setQuantity(bookId, current - 1);
  } else if (e.target.closest(".cart-line-remove")) {
    removeFromCart(bookId);
  }
});
