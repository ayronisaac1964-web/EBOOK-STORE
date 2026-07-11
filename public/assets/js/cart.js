/* ============================================
   CART ENGINE — shared cart logic for every page
   ============================================

   STORAGE: client-side only, no backend yet. Cart lives in
   localStorage under CART_STORAGE_KEY as a plain object:
     { "book-one": 2, "book-three": 1 }
   Keys are book ids (see assets/js/books-data.js), values are
   quantities. This is the ONLY place that shape is assumed —
   every other file goes through the functions below, so when
   the backend/cart-sync step lands later, only this file
   should need to change.

   LOAD ORDER: this file must load AFTER books-data.js (for
   getBookById/formatPrice) and BEFORE main.js / any
   page-specific script that touches the cart.

   EVENTS: every mutation dispatches a "cart:updated" event on
   window so any page (header badge, cart page, checkout page)
   can react without polling.
   ============================================ */

const CART_STORAGE_KEY = "authorshelf_cart_v1";

function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    // Corrupt or blocked storage — fail safe to an empty cart rather than throw.
    console.warn("Cart read failed, resetting cart.", err);
    return {};
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.warn("Cart save failed (storage unavailable or full).", err);
  }
  window.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));
}

function addToCart(bookId, quantity = 1) {
  const cart = getCart();
  cart[bookId] = (cart[bookId] || 0) + quantity;
  saveCart(cart);
  return cart;
}

function setQuantity(bookId, quantity) {
  const cart = getCart();
  if (quantity <= 0) {
    delete cart[bookId];
  } else {
    cart[bookId] = quantity;
  }
  saveCart(cart);
  return cart;
}

function removeFromCart(bookId) {
  const cart = getCart();
  delete cart[bookId];
  saveCart(cart);
  return cart;
}

function clearCart() {
  saveCart({});
}

// Total number of items (sum of quantities) — used for the header badge.
function getCartCount() {
  const cart = getCart();
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

// Joins cart quantities with BOOKS (assets/js/books-data.js) so pages get
// full book info + line totals in one call. Entries pointing at a book id
// that no longer exists in the catalog are silently dropped.
function getCartDetails() {
  const cart = getCart();
  return Object.entries(cart)
    .map(([bookId, quantity]) => {
      const book = getBookById(bookId);
      if (!book) return null;
      return { book, quantity, lineTotal: book.price * quantity };
    })
    .filter(Boolean);
}

function getCartTotal() {
  return getCartDetails().reduce((sum, item) => sum + item.lineTotal, 0);
}
