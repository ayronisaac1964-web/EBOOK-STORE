let booksCache = [];

if (requireAdminSession()) {
  loadBooks();
}

function showBooksMessage(text, type) {
  const el = document.getElementById("books-message");
  el.innerHTML = text ? `<div class="admin-message ${type}">${text}</div>` : "";
}

function formatNaira(amount) {
  return "\u20A6" + amount.toLocaleString("en-NG");
}

async function loadBooks() {
  try {
    const res = await adminFetch("/api/admin/books");
    const data = await res.json();
    if (!res.ok) {
      showBooksMessage(data.error || "Could not load books", "error");
      return;
    }
    booksCache = data;
    renderBooks();
  } catch (err) {
    console.error("Could not load books", err);
    showBooksMessage("Could not reach the server.", "error");
  }
}

function renderBooks() {
  const body = document.getElementById("books-body");
  if (booksCache.length === 0) {
    body.innerHTML = `<tr><td colspan="4">No books yet — add your first one.</td></tr>`;
    return;
  }

  body.innerHTML = booksCache
    .map(
      (book) => `
    <tr data-id="${book.id}">
      <td>${book.title}</td>
      <td>${formatNaira(book.price)}</td>
      <td>${book.active ? '<span class="status-pill paid">active</span>' : '<span class="status-pill inactive">inactive</span>'}</td>
      <td class="row-actions">
        <button class="btn btn-secondary" data-action="edit" data-id="${book.id}">Edit</button>
        ${
          book.active
            ? `<button class="btn btn-secondary" data-action="remove" data-id="${book.id}">Remove</button>`
            : `<button class="btn btn-secondary" data-action="restore" data-id="${book.id}">Restore</button>`
        }
      </td>
    </tr>
  `
    )
    .join("");
}

document.getElementById("books-body").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "edit") {
    openEditForm(id);
  } else if (action === "remove") {
    if (!confirm("Remove this book? It will disappear from the storefront, but past orders and download links for it will keep working.")) return;
    await setBookActive(id, false);
  } else if (action === "restore") {
    await setBookActive(id, true);
  }
});

async function setBookActive(id, active) {
  showBooksMessage("", "");
  try {
    const res = active
      ? await adminFetch(`/api/admin/books/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        })
      : await adminFetch(`/api/admin/books/${encodeURIComponent(id)}`, { method: "DELETE" });

    const data = await res.json();
    if (!res.ok) {
      showBooksMessage(data.error || "Action failed", "error");
      return;
    }
    await loadBooks();
  } catch (err) {
    console.error("Could not update book status", err);
    showBooksMessage("Could not reach the server.", "error");
  }
}

function openEditForm(id) {
  const book = booksCache.find((b) => b.id === id);
  if (!book) return;

  document.getElementById("edit-form").style.display = "flex";
  document.getElementById("edit-title-label").textContent = book.title;
  document.getElementById("edit-id").value = book.id;
  document.getElementById("edit-title").value = book.title;
  document.getElementById("edit-description").value = book.description || "";
  document.getElementById("edit-price").value = book.price;
  document.getElementById("edit-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("edit-cancel").addEventListener("click", () => {
  document.getElementById("edit-form").style.display = "none";
});

document.getElementById("edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showBooksMessage("", "");

  const id = document.getElementById("edit-id").value;
  const update = {
    title: document.getElementById("edit-title").value,
    description: document.getElementById("edit-description").value,
    price: Number(document.getElementById("edit-price").value),
  };

  try {
    const res = await adminFetch(`/api/admin/books/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const data = await res.json();
    if (!res.ok) {
      showBooksMessage(data.error || "Could not save changes", "error");
      return;
    }
    showBooksMessage("Book updated.", "success");
    document.getElementById("edit-form").style.display = "none";
    await loadBooks();
  } catch (err) {
    console.error("Could not save book", err);
    showBooksMessage("Could not reach the server.", "error");
  }
});
