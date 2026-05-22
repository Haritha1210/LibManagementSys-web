const api = {
  books: "/api/books",
  authors: "/api/authors",
  borrowers: "/api/borrowers",
  loans: "/api/loans",
  dashboard: "/api/dashboard"
};

const state = {
  books: [],
  authors: [],
  borrowers: [],
  loans: [],
  dashboard: {}
};

const $ = (selector) => document.querySelector(selector);
const today = () => new Date().toISOString().slice(0, 10);
const memoryStore = {};

function storageGet(key) {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : memoryStore[key] || null;
  } catch {
    return memoryStore[key] || null;
  }
}

function storageSet(key, value) {
  memoryStore[key] = value;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {}
}

function storageRemove(key) {
  delete memoryStore[key];
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {}
}

const storedTheme = storageGet("library-theme") || "light";
const adminPassword = "library123";
let isLoggedIn = false;

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  $("#theme-toggle").setAttribute("aria-label", `Switch to ${nextTheme === "dark" ? "light" : "dark"} mode`);
  storageSet("library-theme", nextTheme);
}

function requireStaff() {
  if (isLoggedIn) return true;
  showAlert("Please log in first.", true);
  $("#login-dialog").showModal();
  return false;
}

function updateAuthUi() {
  if (isLoggedIn) {
    document.body.dataset.role = "admin";
    $("#session-status").textContent = "Admin";
    $("#staff-note").textContent = "Admin access active. Management tools are enabled.";
    $("#logout-button").classList.remove("is-hidden");
    $("#login-button").classList.add("is-hidden");
  } else {
    delete document.body.dataset.role;
    $("#session-status").textContent = "Guest";
    $("#staff-note").textContent = "Login to manage library records.";
    $("#logout-button").classList.add("is-hidden");
    $("#login-button").classList.remove("is-hidden");
  }
}

async function request(url, options = {}) {
  if (typeof fetch !== "function") {
    return xhrRequest(url, options);
  }
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function xhrRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "GET", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        reject(new Error("Invalid JSON response."));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Request failed."));
    };
    xhr.onerror = () => reject(new Error("Network request failed."));
    xhr.send(options.body || null);
  });
}

function showAlert(message, isError = false) {
  const alert = $("#alert");
  alert.textContent = message;
  alert.className = `alert has-message${isError ? " is-error" : ""}`;
  window.clearTimeout(showAlert.timer);
  showAlert.timer = window.setTimeout(() => {
    alert.textContent = "";
    alert.className = "alert";
  }, 3500);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function fillForm(form, record) {
  Object.entries(record).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
}

function isOverdue(loan) {
  return loan.status === "issued" && loan.dueDate < today();
}

function loanStatus(loan) {
  if (isOverdue(loan)) return "overdue";
  return loan.status;
}

async function loadAll() {
  const [books, authors, borrowers, loans, dashboard] = await Promise.all([
    request(api.books),
    request(api.authors),
    request(api.borrowers),
    request(api.loans),
    request(api.dashboard)
  ]);
  Object.assign(state, { books, authors, borrowers, loans, dashboard });
  renderAll();
}

function renderAll() {
  renderSelects();
  renderDashboard();
  renderBooks();
  renderAuthors();
  renderBorrowers();
  renderLoanSummary();
  renderLoans();
}

function renderSelects() {
  const authorOptions = state.authors
    .map((author) => `<option value="${author.id}">${escapeHtml(author.name)}</option>`)
    .join("");
  $("#book-form select[name='authorId']").innerHTML = authorOptions;

  const availableBooks = state.books
    .filter((book) => book.availableCopies > 0)
    .map((book) => `<option value="${book.id}">${escapeHtml(book.title)} (${book.availableCopies} available)</option>`)
    .join("");
  $("#loan-form select[name='bookId']").innerHTML = availableBooks;

  $("#loan-form select[name='borrowerId']").innerHTML = state.borrowers
    .map((borrower) => `<option value="${borrower.id}">${escapeHtml(borrower.name)}</option>`)
    .join("");

  const genres = [...new Set(state.books.map((book) => book.genre).filter(Boolean))].sort();
  $("#book-filter").innerHTML = `<option value="">All genres</option>${genres
    .map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`)
    .join("")}`;
}

function renderDashboard() {
  const labels = [
    ["totalBooks", "Total copies"],
    ["availableBooks", "Available"],
    ["borrowedBooks", "Borrowed"],
    ["overdueLoans", "Overdue"],
    ["authors", "Authors"],
    ["borrowers", "Borrowers"]
  ];

  const overdue = state.loans.filter((loan) => isOverdue(loan));
  const overdueBanner = overdue.length
    ? `<div class="overdue-banner">⚠ ${overdue.length} overdue loan${overdue.length > 1 ? "s" : ""} — please contact borrower${overdue.length > 1 ? "s" : ""} to return books.</div>`
    : "";

  const limbo = state.borrowers.filter((b) => b.borrowedCount >= b.maxBooks);
  const limitBanner = limbo.length
    ? `<div class="limit-banner">${limbo.map((b) => `${escapeHtml(b.name)}`).join(", ")} at max borrow limit.</div>`
    : "";

  $("#metrics").innerHTML = (overdueBanner + limitBanner) +
    labels
    .map(([key, label]) => `<article class="metric"><strong>${state.dashboard[key] ?? 0}</strong><span>${label}</span></article>`)
    .join("");
  $("#recent-loans").innerHTML = state.loans
    .slice()
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .slice(0, 6)
    .map(
      (loan) => `<tr>
        <td>${escapeHtml(loan.bookTitle)}</td>
        <td>${escapeHtml(loan.borrowerName)}</td>
        <td>${loan.issueDate}</td>
        <td>${loan.dueDate}</td>
        <td><span class="status ${loanStatus(loan)}">${loanStatus(loan)}</span></td>
      </tr>`
    )
    .join("");
}

function renderBooks() {
  const query = $("#book-search").value.toLowerCase();
  const genre = $("#book-filter").value;
  const sortBy = $("#book-sort").value;
  const rows = state.books
    .filter((book) => !genre || book.genre === genre)
    .filter((book) => [book.title, book.authorName, book.genre, book.isbn].join(" ").toLowerCase().includes(query))
    .sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, { numeric: true }));

  $("#book-table").innerHTML = rows
    .map(
      (book) => `<tr>
        <td><strong>${escapeHtml(book.title)}</strong><div class="muted">${book.publishedYear || "Year not set"}</div></td>
        <td>${escapeHtml(book.authorName)}</td>
        <td>${escapeHtml(book.genre)}</td>
        <td>${escapeHtml(book.isbn)}</td>
        <td><span class="status ${book.availableCopies ? "available" : "issued"}">${book.availableCopies}/${book.totalCopies}</span></td>
        <td class="staff-only">
          <div class="row-actions">
            <button class="secondary" data-edit-book="${book.id}">Edit</button>
            <button class="danger" data-delete-book="${book.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

function renderAuthors() {
  const query = $("#author-search").value.toLowerCase();
  const sortBy = $("#author-sort").value;
  $("#author-table").innerHTML = state.authors
    .filter((author) => [author.name, author.country, author.bio].join(" ").toLowerCase().includes(query))
    .sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, { numeric: true }))
    .map(
      (author) => `<tr>
        <td><strong>${escapeHtml(author.name)}</strong></td>
        <td>${escapeHtml(author.country)}</td>
        <td><span class="status available">${author.bookCount || 0} titles</span><div class="muted">${author.totalCopies || 0} copies</div></td>
        <td>${escapeHtml(author.bio || "No bio added")}</td>
        <td class="staff-only">
          <div class="row-actions">
            <button class="secondary" data-edit-author="${author.id}">Edit</button>
            <button class="danger" data-delete-author="${author.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

function renderBorrowers() {
  const query = $("#borrower-search").value.toLowerCase();
  const filter = $("#borrower-filter").value;
  const sortBy = $("#borrower-sort").value;
  const rows = state.borrowers
    .filter((borrower) => [borrower.name, borrower.email, borrower.phone].join(" ").toLowerCase().includes(query))
    .filter((borrower) => {
      if (filter === "active") return borrower.borrowedCount > 0;
      if (filter === "overdue") return borrower.overdueCount > 0;
      if (filter === "limit") return borrower.borrowedCount >= borrower.maxBooks;
      return true;
    })
    .sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, { numeric: true }));

  $("#borrower-table").innerHTML = rows
    .map(
      (borrower) => `<tr>
        <td><strong>${escapeHtml(borrower.name)}</strong></td>
        <td>${escapeHtml(borrower.email)}<div class="muted">${escapeHtml(borrower.phone)}</div></td>
        <td>${borrower.membershipDate}</td>
        <td>${borrower.borrowedCount}/${borrower.maxBooks}${borrower.overdueCount ? `<div><span class="status overdue">${borrower.overdueCount} overdue</span></div>` : ""}</td>
        <td>${borrower.loanCount || 0} total<div class="muted">${borrower.borrowedCount ? "Active borrower" : "No active loans"}</div></td>
        <td class="staff-only">
          <div class="row-actions">
            <button class="secondary" data-edit-borrower="${borrower.id}">Edit</button>
            <button class="danger" data-delete-borrower="${borrower.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

function renderLoanSummary() {
  const issued = state.loans.filter((loan) => loan.status === "issued");
  const overdue = issued.filter(isOverdue);
  const returned = state.loans.filter((loan) => loan.status === "returned");
  $("#loan-summary").innerHTML = [
    ["Issued", issued.length],
    ["Overdue", overdue.length],
    ["Returned", returned.length],
    ["Available Books", state.books.reduce((sum, book) => sum + book.availableCopies, 0)]
  ]
    .map(([label, value]) => `<article class="mini-metric"><strong>${value}</strong><span>${label}</span></article>`)
    .join("");
}

function renderLoans() {
  const query = $("#loan-search").value.toLowerCase();
  const filter = $("#loan-filter").value;
  const rows = state.loans
    .filter((loan) => !filter || loan.status === filter || (filter === "overdue" && isOverdue(loan)))
    .filter((loan) => [loan.bookTitle, loan.borrowerName].join(" ").toLowerCase().includes(query))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  $("#loan-table").innerHTML = rows
    .map(
      (loan) => `<tr>
        <td>${escapeHtml(loan.bookTitle)}</td>
        <td>${escapeHtml(loan.borrowerName)}</td>
        <td>${loan.issueDate}</td>
        <td>${loan.dueDate}${loan.returnDate ? `<div class="muted">Returned ${loan.returnDate}</div>` : ""}</td>
        <td><span class="status ${loanStatus(loan)}">${loanStatus(loan)}</span></td>
        <td class="staff-only">${loan.status === "issued" ? `<button class="secondary" data-return-loan="${loan.id}">Return</button>` : ""}</td>
      </tr>`
    )
    .join("");
}

async function saveRecord(entity, form, buildPayload) {
  if (!requireStaff()) return;
  const data = buildPayload(formData(form));
  const id = form.elements.id?.value;
  const url = id ? `${api[entity]}/${id}` : api[entity];
  const method = id ? "PUT" : "POST";
  await request(url, { method, body: JSON.stringify(data) });
  form.reset();
  form.querySelector(".cancel-edit")?.classList.add("is-hidden");
  showAlert(`${entity.slice(0, -1)} saved successfully.`);
  await loadAll();
}

async function deleteRecord(entity, id) {
  if (!requireStaff()) return;
  if (!confirm("Delete this record?")) return;
  await request(`${api[entity]}/${id}`, { method: "DELETE" });
  showAlert("Record deleted.");
  await loadAll();
}

function setupEvents() {
  applyTheme(storedTheme);
  updateAuthUi();

  $("#theme-toggle").addEventListener("click", () => {
    const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  });

  $("#login-button").addEventListener("click", () => {
    $("#login-form").reset();
    $("#login-dialog").showModal();
  });

  $("#close-login").addEventListener("click", () => $("#login-dialog").close());

  $("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    if (data.password !== adminPassword) {
      showAlert("Incorrect password.", true);
      return;
    }
    isLoggedIn = true;
    updateAuthUi();
    $("#login-dialog").close();
    showAlert("Admin logged in.");
  });

  $("#logout-button").addEventListener("click", () => {
    isLoggedIn = false;
    updateAuthUi();
    showAlert("Logged out.");
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .section").forEach((item) => item.classList.remove("is-active"));
      tab.classList.add("is-active");
      $(`#${tab.dataset.section}`).classList.add("is-active");
    });
  });

  $("#refresh-dashboard").addEventListener("click", loadAll);
  ["book-search", "book-filter", "book-sort"].forEach((id) => $(`#${id}`).addEventListener("input", renderBooks));
  ["author-search", "author-sort"].forEach((id) => $(`#${id}`).addEventListener("input", renderAuthors));
  ["borrower-search", "borrower-filter", "borrower-sort"].forEach((id) => $(`#${id}`).addEventListener("input", renderBorrowers));
  ["loan-search", "loan-filter"].forEach((id) => $(`#${id}`).addEventListener("input", renderLoans));
  ["#loan-days", "#loan-form input[name='issueDate']"].forEach((selector) => $(selector).addEventListener("input", updateDueDateFromPeriod));

  $("#book-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRecord("books", event.currentTarget, (data) => ({
      ...data,
      totalCopies: Number(data.totalCopies),
      publishedYear: Number(data.publishedYear)
    }));
  });

  $("#author-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRecord("authors", event.currentTarget, (data) => data);
  });

  $("#borrower-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRecord("borrowers", event.currentTarget, (data) => ({ ...data, maxBooks: Number(data.maxBooks) }));
  });

  $("#loan-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireStaff()) return;
    try {
      await request("/api/loans/issue", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) });
      event.currentTarget.reset();
      setDefaultDates();
      showAlert("Book issued successfully.");
      await loadAll();
    } catch (error) {
      showAlert(error.message, true);
    }
  });

  document.querySelectorAll(".cancel-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = btn.closest("form");
      form.reset();
      form.elements.id.value = "";
      btn.classList.add("is-hidden");
    });
  });

  document.querySelectorAll(".form-grid button[type='reset']").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest("form").querySelector(".cancel-edit")?.classList.add("is-hidden");
    });
  });

  document.body.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    try {
      if (button.dataset.editBook) {
        fillForm($("#book-form"), state.books.find((book) => book.id === button.dataset.editBook));
        $("#book-form .cancel-edit").classList.remove("is-hidden");
      }
      if (button.dataset.editAuthor) {
        fillForm($("#author-form"), state.authors.find((author) => author.id === button.dataset.editAuthor));
        $("#author-form .cancel-edit").classList.remove("is-hidden");
      }
      if (button.dataset.editBorrower) {
        fillForm($("#borrower-form"), state.borrowers.find((borrower) => borrower.id === button.dataset.editBorrower));
        $("#borrower-form .cancel-edit").classList.remove("is-hidden");
      }
      if (button.dataset.deleteBook) await deleteRecord("books", button.dataset.deleteBook);
      if (button.dataset.deleteAuthor) await deleteRecord("authors", button.dataset.deleteAuthor);
      if (button.dataset.deleteBorrower) await deleteRecord("borrowers", button.dataset.deleteBorrower);
      if (button.dataset.returnLoan) {
        if (!requireStaff()) return;
        await request(`/api/loans/${button.dataset.returnLoan}/return`, { method: "PATCH" });
        showAlert("Book returned successfully.");
        await loadAll();
      }
      if (button.dataset.export) {
        if (!requireStaff()) return;
        exportCsv(button.dataset.export);
      }
    } catch (error) {
      showAlert(error.message, true);
    }
  });
}

function setDefaultDates() {
  const issue = $("#loan-form input[name='issueDate']");
  issue.value = today();
  updateDueDateFromPeriod();
}

function updateDueDateFromPeriod() {
  const issue = $("#loan-form input[name='issueDate']");
  const due = $("#loan-form input[name='dueDate']");
  const days = Number($("#loan-days").value || 14);
  const dueDate = new Date(issue.value || today());
  dueDate.setDate(dueDate.getDate() + Math.max(1, days));
  due.value = dueDate.toISOString().slice(0, 10);
}

function exportCsv(entity) {
  const rows = state[entity];
  if (!rows.length) return showAlert("No data to export.", true);
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${entity}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

setupEvents();
setDefaultDates();
loadAll().catch((error) => showAlert(error.message, true));
