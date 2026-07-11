/* ============================================
   BOOK CATALOG — now backed by /api/books (MongoDB)
   ============================================

   Same public contract as the old placeholder file so nothing else
   (cart.js, storefront.js, book-detail.js, checkout.js, cart-page.js)
   has to change its call sites: BOOKS (array), getBookById(id), formatPrice(amount).

   The only difference: BOOKS starts empty and is populated async. Every
   page script awaits window.BOOKS_READY before its first render — see the
   top of each page-specific .js file.
   ============================================ */

let BOOKS = [];

window.BOOKS_READY = fetch("/api/books")
  .then((res) => {
    if (!res.ok) throw new Error(`Failed to load books (${res.status})`);
    return res.json();
  })
  .then((data) => {
    BOOKS = data;
    return BOOKS;
  })
  .catch((err) => {
    console.error("Could not load catalog from /api/books", err);
    BOOKS = [];
    return BOOKS;
  });

function getBookById(id) {
  return BOOKS.find((book) => book.id === id) || null;
}

// Shared price formatter (Naira, no kobo) — used on every page that shows a price.
function formatPrice(amount) {
  return "\u20A6" + amount.toLocaleString("en-NG");
}
