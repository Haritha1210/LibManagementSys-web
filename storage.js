const fs = require("fs/promises");
const path = require("path");
const os = require("os");

function findRedisEnv() {
  const urlSuffixes = ["KV_URL", "REDIS_URL", "KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"];
  for (const key of Object.keys(process.env)) {
    const upper = key.toUpperCase();
    const match = urlSuffixes.find(s => upper === s || upper.endsWith("_" + s));
    if (!match) continue;
    const url = process.env[key];
    const base = upper.endsWith("_" + match) ? upper.slice(0, -match.length - 1) : "";
    const tokenKey = base ? `${base}_KV_REST_API_TOKEN` : "KV_REST_API_TOKEN";
    const tokenKey2 = base ? `${base}_UPSTASH_REDIS_REST_TOKEN` : "UPSTASH_REDIS_REST_TOKEN";
    const token = process.env[tokenKey] || process.env[tokenKey2] || "";
    return { url, token, urlKey: key };
  }
  return null;
}

const redisEnv = findRedisEnv();

let redisClient = null;
if (redisEnv) {
  try {
    const { Redis } = require("@upstash/redis");
    if (redisEnv.token) {
      redisClient = new Redis({ url: redisEnv.url, token: redisEnv.token });
    } else {
      redisClient = new Redis({ url: redisEnv.url });
    }
    console.log(`Storage: connected to Redis via ${redisEnv.urlKey}`);
  } catch (e) {
    console.warn(`Storage: Redis via @upstash/redis failed: ${e.message}`);
    try {
      const { createClient } = require("@vercel/kv");
      const opts = { url: redisEnv.url };
      if (redisEnv.token) opts.token = redisEnv.token;
      redisClient = createClient(opts);
      console.log(`Storage: connected to Redis via @vercel/kv (${redisEnv.urlKey})`);
    } catch (e2) {
      console.warn(`Storage: Redis via @vercel/kv also failed: ${e2.message}`);
    }
  }
}

const isTempStorage = !redisClient && process.env.VERCEL;
const DATA_DIR = redisClient ? null : path.join(isTempStorage ? os.tmpdir() : __dirname, "data");
const DB_FILE = DATA_DIR ? path.join(DATA_DIR, "db.json") : null;

if (isTempStorage && !redisClient) {
  console.warn("Storage: WARNING - No Redis, using /tmp (data will reset on cold starts)");
}

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

async function readDb() {
  if (redisClient) {
    const data = await redisClient.get("db");
    if (data) return data;
    await redisClient.set("db", defaultDb);
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
  if (redisClient) {
    await redisClient.set("db", db);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function getStorageInfo() {
  if (redisClient) return { type: "redis", envVar: redisEnv?.urlKey };
  if (isTempStorage) return { type: "temp_file", path: DB_FILE };
  return { type: "local_file", path: DB_FILE };
}

module.exports = { readDb, writeDb, getStorageInfo };
