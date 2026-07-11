// Shared JS, loaded on every page.
// FAQ accordions use native <details>/<summary> — no JS needed for that.
// Add page-specific scripts as separate files (e.g. assets/js/storefront.js)
// and include them only on the pages that need them.
//
// Requires assets/js/cart.js to be loaded first (for getCartCount()).

document.addEventListener("DOMContentLoaded", updateCartBadge);
window.addEventListener("cart:updated", updateCartBadge);

// Every page has a #cart-count badge in the header — keep it in sync with
// the cart in localStorage. Cheap enough to just re-run on every update.
function updateCartBadge() {
  const badges = document.querySelectorAll(".cart-count");
  if (!badges.length) return;
  const count = getCartCount();
  badges.forEach((badge) => {
    badge.textContent = count;
  });
}
