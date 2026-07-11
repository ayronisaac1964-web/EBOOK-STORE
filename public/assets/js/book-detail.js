// Book detail page — one shared template for every book.
//
// ROUTING APPROACH: this is a static site with no server-side routing, so
// the book is chosen via a URL query param rather than a path segment:
//   pages/book-detail.html?id=book-one
// storefront.js links to this pattern already. Swap getBookById() for an
// API/database lookup later (e.g. `await fetch(`/api/books/${id}`)`) and
// the rest of this file stays the same.

document.addEventListener("DOMContentLoaded", async () => {
  await window.BOOKS_READY; // BOOKS loads async from /api/books — see books-data.js
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const book = id ? getBookById(id) : null;

  if (!book) {
    showNotFound();
    return;
  }

  renderBook(book);
});

function renderBook(book) {
  document.getElementById("page-title").textContent = `${book.title} — Author Name`;
  document.getElementById("detail-title").textContent = book.title;
  document.getElementById("detail-price").textContent = formatPrice(book.price);
  document.getElementById("detail-description").textContent = book.description;

  const coverEl = document.getElementById("detail-cover");
  if (book.cover) {
    coverEl.innerHTML = `<img src="${book.cover}" alt="${book.title} cover">`;
  }

  const addBtn = document.getElementById("add-to-cart-btn");
  addBtn.dataset.bookId = book.id;
  const originalLabel = addBtn.textContent;
  addBtn.addEventListener("click", () => {
    addToCart(book.id, 1);
    addBtn.textContent = "Added ✓";
    addBtn.disabled = true;
    setTimeout(() => {
      addBtn.textContent = originalLabel;
      addBtn.disabled = false;
    }, 1200);
  });

  if (book.excerpt) {
    document.getElementById("excerpt-block").hidden = false;
    document.getElementById("excerpt-text").textContent = book.excerpt;
  }
}

function showNotFound() {
  document.getElementById("book-detail-root").hidden = true;
  document.getElementById("book-not-found").hidden = false;
}
