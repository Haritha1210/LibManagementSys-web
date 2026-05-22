# Library Management System

A full-stack Library Management System for managing books, authors, borrowers, and book issue/return activity.

## Features

- Dashboard with total copies, available books, borrowed books, overdue loans, authors, and borrowers
- CRUD operations for books, authors, and borrowers
- Password-only Admin and Librarian login for management tools
- Search and filter for books, borrowers, and loan records
- Borrow/return workflow with due dates, overdue status, and max borrow limit checks
- Borrower history through the loans table
- Sorting by author, genre, borrower, availability, and membership date
- CSV export for books, authors, borrowers, and loans
- Responsive UI using semantic forms, tables, and navigation
- REST API with validation and error handling

## Setup

1. Install Node.js.
2. Open this project folder in a terminal.
3. Install dependencies:

```bash
npm install
```

4. Run:

```bash
node server.js
```

5. Open:

```text
http://localhost:3000
```

The backend uses Node.js with Express and a JSON database file in `data/db.json`.

## Staff Login

Management actions are hidden until a staff member logs in.

| Role | Password |
| --- | --- |
| Admin | `admin123` |
| Librarian | `library123` |

## API Routes

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/books` | List books |
| POST | `/api/books` | Add a book |
| GET | `/api/books/:id` | View one book |
| PUT | `/api/books/:id` | Update a book |
| DELETE | `/api/books/:id` | Delete a book |
| GET | `/api/authors` | List authors |
| POST | `/api/authors` | Add an author |
| PUT | `/api/authors/:id` | Update an author |
| DELETE | `/api/authors/:id` | Delete an author |
| GET | `/api/borrowers` | List borrowers |
| POST | `/api/borrowers` | Add a borrower |
| PUT | `/api/borrowers/:id` | Update a borrower |
| DELETE | `/api/borrowers/:id` | Delete a borrower |
| GET | `/api/loans` | List borrow history |
| POST | `/api/loans/issue` | Issue a book |
| PATCH | `/api/loans/:id/return` | Return a book |
| GET | `/api/dashboard` | Dashboard counts |

## Database Schema

The data is stored in `data/db.json`.

### Author

```json
{
  "id": "string",
  "name": "string",
  "country": "string",
  "bio": "string"
}
```

### Book

```json
{
  "id": "string",
  "title": "string",
  "authorId": "string",
  "genre": "string",
  "isbn": "string",
  "publishedYear": 1997,
  "totalCopies": 5,
  "availableCopies": 4
}
```

### Borrower

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "membershipDate": "YYYY-MM-DD",
  "maxBooks": 3
}
```

### Loan

```json
{
  "id": "string",
  "bookId": "string",
  "borrowerId": "string",
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD or null",
  "status": "issued or returned"
}
```

## Deployment

Frontend and backend are served by the same Node server, so deploy this project as a Node app on Render, Railway, Heroku, or a similar platform.

Use this start command:

```bash
node server.js
```

## Live Deployments

- **Render**: [https://libmanagementsys-web.onrender.com](https://libmanagementsys-web.onrender.com)
- **Vercel**: *(add Vercel URL after deployment)*

## Project Structure

```text
.
├── data/
│   └── db.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── package.json
├── README.md
└── server.js
```
