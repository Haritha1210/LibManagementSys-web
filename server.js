const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const defaultDb = {
  authors: [
    { id: "author-rowling", name: "J.K. Rowling", country: "United Kingdom", bio: "Author of the Harry Potter fantasy series." },
    { id: "author-orwell", name: "George Orwell", country: "United Kingdom", bio: "Novelist and essayist known for political fiction." },
    { id: "author-austen", name: "Jane Austen", country: "United Kingdom", bio: "Classic novelist known for social commentary and romance." }
  ],
  books: [
    { id: "book-hp1", title: "Harry Potter and the Philosopher's Stone", authorId: "author-rowling", genre: "Fantasy", isbn: "9780747532699", publishedYear: 1997, totalCopies: 5, availableCopies: 4 },
    { id: "book-1984", title: "1984", authorId: "author-orwell", genre: "Dystopian", isbn: "9780451524935", publishedYear: 1949, totalCopies: 4, availableCopies: 3 },
    { id: "book-pride", title: "Pride and Prejudice", authorId: "author-austen", genre: "Classic", isbn: "9780141439518", publishedYear: 1813, totalCopies: 3, availableCopies: 3 }
  ],
  borrowers: [
    { id: "borrower-aman", name: "Aman Sharma", email: "aman@example.com", phone: "9876543210", membershipDate: "2026-01-10", maxBooks: 3 },
    { id: "borrower-meera", name: "Meera Kapoor", email: "meera@example.com", phone: "9988776655", membershipDate: "2026-02-14", maxBooks: 2 }
  ],
  loans: [
    { id: "loan-1984", bookId: "book-1984", borrowerId: "borrower-aman", issueDate: "2026-05-01", dueDate: "2026-05-15", returnDate: null, status: "issued" },
    { id: "loan-hp1", bookId: "book-hp1", borrowerId: "borrower-meera", issueDate: "2026-05-07", dueDate: "2026-05-21", returnDate: null, status: "issued" }
  ]
};

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await writeDb(defaultDb);
  }
}

async function readDb() {
  await ensureDb();
  return JSON.parse(await fs.readFile(DB_FILE, "utf8"));
}

async function writeDb(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function clean(value) {
  return String(value || "").trim();
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !clean(body[field]));
  if (missing.length) fail(400, `Missing required field(s): ${missing.join(", ")}.`);
}

function buildAuthor(body, existing = {}) {
  requireFields(body, ["name", "country"]);
  return { ...existing, name: clean(body.name), country: clean(body.country), bio: clean(body.bio) };
}

function buildBorrower(body, existing = {}) {
  requireFields(body, ["name", "email", "phone"]);
  const maxBooks = Number(body.maxBooks || existing.maxBooks || 3);
  if (!Number.isInteger(maxBooks) || maxBooks < 1) fail(400, "Max books must be a positive whole number.");

  return {
    ...existing,
    name: clean(body.name),
    email: clean(body.email),
    phone: clean(body.phone),
    membershipDate: clean(body.membershipDate) || new Date().toISOString().slice(0, 10),
    maxBooks
  };
}

function buildBook(body, existing = {}) {
  requireFields(body, ["title", "authorId", "genre", "isbn"]);
  const totalCopies = Number(body.totalCopies);
  const publishedYear = Number(body.publishedYear);
  const issuedCopies = Number.isInteger(existing.totalCopies) && Number.isInteger(existing.availableCopies)
    ? Math.max(0, existing.totalCopies - existing.availableCopies)
    : 0;

  if (!Number.isInteger(totalCopies) || totalCopies < 1) fail(400, "Total copies must be a positive whole number.");
  if (totalCopies < issuedCopies) {
    fail(400, `Total copies cannot be lower than the ${issuedCopies} currently issued copy/copies.`);
  }

  return {
    ...existing,
    title: clean(body.title),
    authorId: clean(body.authorId),
    genre: clean(body.genre),
    isbn: clean(body.isbn),
    publishedYear: Number.isInteger(publishedYear) ? publishedYear : null,
    totalCopies,
    availableCopies: totalCopies - issuedCopies
  };
}

function enrich(db) {
  const authors = Object.fromEntries(db.authors.map((author) => [author.id, author]));
  const books = Object.fromEntries(db.books.map((book) => [book.id, book]));
  const borrowers = Object.fromEntries(db.borrowers.map((borrower) => [borrower.id, borrower]));

  return {
    ...db,
    authors: db.authors.map((author) => {
      const authorBooks = db.books.filter((book) => book.authorId === author.id);
      return {
        ...author,
        bookCount: authorBooks.length,
        totalCopies: authorBooks.reduce((sum, book) => sum + book.totalCopies, 0)
      };
    }),
    books: db.books.map((book) => ({
      ...book,
      authorName: authors[book.authorId]?.name || "Unknown author",
      activeLoans: db.loans.filter((loan) => loan.bookId === book.id && loan.status === "issued").length
    })),
    borrowers: db.borrowers.map((borrower) => ({
      ...borrower,
      borrowedCount: db.loans.filter((loan) => loan.borrowerId === borrower.id && loan.status === "issued").length,
      loanCount: db.loans.filter((loan) => loan.borrowerId === borrower.id).length,
      overdueCount: db.loans.filter((loan) => loan.borrowerId === borrower.id && loan.status === "issued" && loan.dueDate < new Date().toISOString().slice(0, 10)).length
    })),
    loans: db.loans.map((loan) => ({
      ...loan,
      bookTitle: books[loan.bookId]?.title || "Unknown book",
      borrowerName: borrowers[loan.borrowerId]?.name || "Unknown borrower"
    }))
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function crudRoutes(collectionName, builder) {
  app.get(`/api/${collectionName}`, asyncRoute(async (req, res) => {
    const db = await readDb();
    res.json(enrich(db)[collectionName]);
  }));

  app.get(`/api/${collectionName}/:id`, asyncRoute(async (req, res) => {
    const db = await readDb();
    const record = enrich(db)[collectionName].find((item) => item.id === req.params.id);
    if (!record) fail(404, "Record not found.");
    res.json(record);
  }));

  app.post(`/api/${collectionName}`, asyncRoute(async (req, res) => {
    const db = await readDb();
    const record = { id: randomUUID(), ...builder(req.body) };
    if (collectionName === "books" && !db.authors.some((author) => author.id === record.authorId)) {
      fail(400, "Selected author does not exist.");
    }
    db[collectionName].push(record);
    await writeDb(db);
    res.status(201).json(enrich(db)[collectionName].find((item) => item.id === record.id));
  }));

  app.put(`/api/${collectionName}/:id`, asyncRoute(async (req, res) => {
    const db = await readDb();
    const index = db[collectionName].findIndex((item) => item.id === req.params.id);
    if (index === -1) fail(404, "Record not found.");
    const record = builder(req.body, db[collectionName][index]);
    if (collectionName === "books" && !db.authors.some((author) => author.id === record.authorId)) {
      fail(400, "Selected author does not exist.");
    }
    db[collectionName][index] = record;
    await writeDb(db);
    res.json(enrich(db)[collectionName].find((item) => item.id === req.params.id));
  }));

  app.delete(`/api/${collectionName}/:id`, asyncRoute(async (req, res) => {
    const db = await readDb();
    const index = db[collectionName].findIndex((item) => item.id === req.params.id);
    if (index === -1) fail(404, "Record not found.");

    const activeLoan = db.loans.some((loan) => loan.status === "issued" && (loan.bookId === req.params.id || loan.borrowerId === req.params.id));
    const assignedBooks = collectionName === "authors" && db.books.some((book) => book.authorId === req.params.id);
    if (activeLoan) fail(409, "Cannot delete a record with active loans.");
    if (assignedBooks) fail(409, "Cannot delete an author while books are assigned.");

    db[collectionName].splice(index, 1);
    await writeDb(db);
    res.json({ success: true });
  }));
}

crudRoutes("books", buildBook);
crudRoutes("authors", buildAuthor);
crudRoutes("borrowers", buildBorrower);

app.get("/api/loans", asyncRoute(async (req, res) => {
  const db = await readDb();
  res.json(enrich(db).loans);
}));

app.post("/api/loans/issue", asyncRoute(async (req, res) => {
  const db = await readDb();
  requireFields(req.body, ["bookId", "borrowerId", "issueDate", "dueDate"]);

  const book = db.books.find((item) => item.id === req.body.bookId);
  const borrower = db.borrowers.find((item) => item.id === req.body.borrowerId);
  if (!book) fail(404, "Book not found.");
  if (!borrower) fail(404, "Borrower not found.");
  if (book.availableCopies < 1) fail(409, "No available copies for this book.");

  const activeLoans = db.loans.filter((loan) => loan.borrowerId === borrower.id && loan.status === "issued");
  if (activeLoans.length >= borrower.maxBooks) fail(409, `${borrower.name} has reached the maximum borrow limit.`);

  const loan = {
    id: randomUUID(),
    bookId: book.id,
    borrowerId: borrower.id,
    issueDate: req.body.issueDate,
    dueDate: req.body.dueDate,
    returnDate: null,
    status: "issued"
  };
  book.availableCopies -= 1;
  db.loans.push(loan);
  await writeDb(db);
  res.status(201).json(enrich(db).loans.find((item) => item.id === loan.id));
}));

app.patch("/api/loans/:id/return", asyncRoute(async (req, res) => {
  const db = await readDb();
  const loan = db.loans.find((item) => item.id === req.params.id);
  if (!loan) fail(404, "Loan not found.");
  if (loan.status === "returned") fail(409, "Loan is already returned.");

  const book = db.books.find((item) => item.id === loan.bookId);
  loan.status = "returned";
  loan.returnDate = new Date().toISOString().slice(0, 10);
  if (book) book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);

  await writeDb(db);
  res.json(enrich(db).loans.find((item) => item.id === req.params.id));
}));

app.get("/api/dashboard", asyncRoute(async (req, res) => {
  const db = await readDb();
  const today = new Date().toISOString().slice(0, 10);
  const issued = db.loans.filter((loan) => loan.status === "issued");

  res.json({
    totalBooks: db.books.reduce((sum, book) => sum + book.totalCopies, 0),
    availableBooks: db.books.reduce((sum, book) => sum + book.availableCopies, 0),
    borrowedBooks: issued.length,
    overdueLoans: issued.filter((loan) => loan.dueDate < today).length,
    authors: db.authors.length,
    borrowers: db.borrowers.length
  });
}));

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  res.status(error.status || 500).json({ error: error.message || "Server error." });
});

app.listen(PORT, () => {
  console.log(`Library Management System running at http://localhost:${PORT}`);
});
