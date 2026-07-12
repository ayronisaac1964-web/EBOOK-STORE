/* ============================================
   LANDING PAGE — wires the hero book + featured
   grid to real catalog data from /api/books
   (via BOOKS / BOOKS_READY in books-data.js).
   No book yet? Everything falls back to a
   designed placeholder, not a broken box.
   ============================================ */

document.addEventListener("DOMContentLoaded", async () => {
  await window.BOOKS_READY;
  renderHeroBook();
  renderFeatured();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderHeroBook() {
  const excerptEl = document.getElementById("manuscript-excerpt");
  const titleEl = document.getElementById("manuscript-title");
  const priceEl = document.getElementById("manuscript-price");
  if (!excerptEl || !titleEl || !priceEl) return;
  if (typeof BOOKS === "undefined" || BOOKS.length === 0) return;

  const book = BOOKS[0];
  const passage = book.excerpt || book.description;
  if (passage) excerptEl.textContent = passage;

  titleEl.textContent = book.title;
  priceEl.textContent = formatPrice(book.price);
}

function renderFeatured() {
  const grid = document.getElementById("book-grid");
  if (!grid) return;

  if (typeof BOOKS === "undefined" || BOOKS.length === 0) {
    grid.innerHTML = `<p class="featured-empty">New titles are on the way — check back soon.</p>`;
    return;
  }

  const cards = BOOKS.slice(0, 4)
    .map((book) => {
      const coverStyle = book.cover ? ` style="background-image:url('${book.cover}')"` : "";
      const coverInner = book.cover ? "" : `<span>${escapeHtml(book.title)}</span>`;
      return `
        <a class="book-card" href="pages/book-detail.html?id=${encodeURIComponent(book.id)}">
          <div class="book-cover${book.cover ? "" : " placeholder"}"${coverStyle}>${coverInner}</div>
          <p class="book-title">${escapeHtml(book.title)}</p>
          <p class="book-price">${formatPrice(book.price)}</p>
        </a>`;
    })
    .join("");

  const showComingSoon = BOOKS.length < 4;
  const comingSoon = showComingSoon
    ? `
      <div class="book-card">
        <div class="book-cover placeholder soon"><span>More titles<br>coming soon</span></div>
      </div>`
    : "";

  grid.innerHTML = cards + comingSoon;
}
