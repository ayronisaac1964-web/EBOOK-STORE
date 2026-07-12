// Storefront page — renders the catalog grid from BOOKS (assets/js/books-data.js).
// Swap BOOKS for a fetched array later; renderCatalog() itself doesn't need to change.
// Requires assets/js/cart.js loaded first for addToCart().

document.addEventListener("DOMContentLoaded", async () => {
  // BOOKS is populated by assets/js/books-data.js's fetch to /api/books —
  // wait for it before the first render, since that script loads first but
  // resolves asynchronously.
  await window.BOOKS_READY;
  renderCatalog(BOOKS);
  initCarousel();

  // One delegated listener covers every .btn-add, including cards re-rendered later.
  document.getElementById("catalog-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-add");
    if (!btn) return;
    addToCart(btn.dataset.bookId, 1);
    flashAdded(btn);
  });
});

// Arrow buttons + dot indicators for the swipeable catalog carousel.
// Scrolling is native (scroll-snap) — this just adds desktop controls
// and keeps the dots in sync with whichever card is in view.
function initCarousel() {
  const track = document.getElementById("catalog-grid");
  const prevBtn = document.getElementById("catalog-prev");
  const nextBtn = document.getElementById("catalog-next");
  const dotsWrap = document.getElementById("catalog-dots");
  const cards = track.querySelectorAll(".book-card");

  if (!cards.length) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  dotsWrap.innerHTML = Array.from(cards)
    .map((_, i) => `<button class="catalog-dot${i === 0 ? " active" : ""}" data-index="${i}" aria-label="Go to book ${i + 1}"></button>`)
    .join("");
  const dots = dotsWrap.querySelectorAll(".catalog-dot");

  function scrollByCard(dir) {
    const card = track.querySelector(".book-card");
    const step = card ? card.getBoundingClientRect().width + 24 : 240;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  prevBtn.addEventListener("click", () => scrollByCard(-1));
  nextBtn.addEventListener("click", () => scrollByCard(1));

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const i = Number(dot.dataset.index);
      cards[i].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    });
  });

  // Update active dot + disabled arrow state as the user scrolls/swipes.
  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollLeft = track.scrollLeft;
      const maxScroll = track.scrollWidth - track.clientWidth;
      prevBtn.disabled = scrollLeft <= 4;
      nextBtn.disabled = scrollLeft >= maxScroll - 4;

      let closest = 0;
      let closestDist = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs(card.offsetLeft - scrollLeft);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      dots.forEach((d, i) => d.classList.toggle("active", i === closest));
      ticking = false;
    });
  });

  prevBtn.disabled = true;
}

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
