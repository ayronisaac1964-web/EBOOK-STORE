// Storefront page — renders the catalog grid from BOOKS (assets/js/books-data.js).
// Swap BOOKS for a fetched array later; renderCatalog() itself doesn't need to change.
// Requires assets/js/cart.js loaded first for addToCart().

document.addEventListener("DOMContentLoaded", async () => {
  // BOOKS is populated by assets/js/books-data.js's fetch to /api/books —
  // wait for it before the first render, since that script loads first but
  // resolves asynchronously.
  await window.BOOKS_READY;
  renderCatalog(BOOKS);

  // One delegated listener covers every .btn-add, including cards re-rendered later.
  document.getElementById("catalog-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-add");
    if (!btn) return;
    addToCart(btn.dataset.bookId, 1);
    flashAdded(btn);
  });
});

// Brief "Added ✓" confirmation on the button itself — no popup/toast needed.
function flashAdded(btn) {
  const original = btn.textContent;
  btn.textContent = "Added ✓";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1200);
}

function renderCatalog(books) {
  const grid = document.getElementById("catalog-grid");

  if (!books || books.length === 0) {
    grid.innerHTML = '<p class="catalog-empty">No books available yet — check back soon.</p>';
    return;
  }

  grid.innerHTML = books.map(bookCardTemplate).join("");
}

function bookCardTemplate(book) {
  const coverInner = book.cover
    ? `<img src="${book.cover}" alt="${book.title} cover">`
    : `<span>Cover placeholder</span>`;

  return `
    <article class="book-card">
      <a href="book-detail.html?id=${encodeURIComponent(book.id)}" class="book-card-link">
        <div class="book-cover placeholder">${coverInner}</div>
        <p class="book-title">${book.title}</p>
        <p class="book-price">${formatPrice(book.price)}</p>
      </a>
      <button class="btn btn-primary btn-add" data-book-id="${book.id}">
        Add to Cart
      </button>
    </article>
  `;
}
