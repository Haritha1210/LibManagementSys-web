const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

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

let kv = null;
if (process.env.KV_URL || process.env.VERCEL) {
  try {
    const { kv: vercelKv } = require("@vercel/kv");
    kv = vercelKv;
  } catch {
    console.warn("@vercel/kv not available, falling back to file storage");
  }
}

const isVercelKv = () => kv !== null;

async function readDb() {
  if (isVercelKv()) {
    const data = await kv.get("db");
    if (data) return data;
    await kv.set("db", defaultDb);
    return defaultDb;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(defaultDb, null, 2));
  }
  return JSON.parse(await fs.readFile(DB_FILE, "utf8"));
}

async function writeDb(db) {
  if (isVercelKv()) {
    await kv.set("db", db);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = { readDb, writeDb };
