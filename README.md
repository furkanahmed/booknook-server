# BookNook Backend API

BookNook is a modern RESTful API service built with Express.js and MongoDB to power the BookNook digital library application.

## Live API & Repositories
- **Live Client Application:** [BookNook Client](https://booknook-nine.vercel.app)
- **Live Server API:** [BookNook Express API](https://book-nook-server.onrender.com) *(or your deployed server endpoint)*
- **Client GitHub Repository:** [https://github.com/furkanahmed/booknook](https://github.com/furkanahmed/booknook)
- **Server GitHub Repository:** [https://github.com/furkanahmed/booknook-server](https://github.com/furkanahmed/booknook-server)

## Core Features
- **Strict 8 REST API Endpoints:** Clean implementation of all mandatory endpoints for book catalog management and borrowing operations.
- **JWT Authentication & Protection:** Secured endpoints with JSON Web Token verification middleware.
- **MongoDB Database Integration:** Scalable document storage using official MongoDB native driver.
- **Atomic Concurrency Control:** Prevents double borrowing and tracks real-time book copies using MongoDB atomic `$inc` updates.
- **Auto-Seeding:** Seamless initial catalog seeding for fast testing and grading evaluation.

## API Endpoints Overview
1. `GET /books` — Retrieve all books (supports sort, limit, owner filter)
2. `GET /books/:id` — Retrieve a single book's details
3. `POST /books` — Add a new book (Protected)
4. `PATCH /books/:id` — Update book information (Protected, Author/Owner only)
5. `DELETE /books/:id` — Remove a book from the catalog (Protected, Author/Owner only)
6. `POST /borrows` — Borrow a book with atomic copy decrement and duplicate checks (Protected)
7. `GET /borrows` — View borrowed books of the authenticated user (Protected)
8. `DELETE /borrows/:id` — Return a borrowed book with atomic copy increment (Protected)

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables Configuration
Create a `.env` file in the server root:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
npm run dev
# or
npm start
```
The server will start on port `5000` (or your configured `PORT`).

