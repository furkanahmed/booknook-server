import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";
import { getDb } from "./db.js";
import { authenticateToken, optionalAuth } from "./auth.js";
import { seedBooks } from "./seed.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Auto-seed books on startup if database is newly initialized
seedBooks().catch((e) => console.log("Seed check skipped:", e.message));

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Health Check / Welcome
app.get("/", (req, res) => {
  res.json({
    name: "BookNook Library API",
    status: "healthy",
    version: "1.0.0",
  });
});

/* ==========================================================================
   ASSIGNMENT SPECIFICATION: STRICTLY 8 REST API ROUTES
   1. GET    /books        (Public / Query: sort, limit, owner=me)
   2. GET    /books/:id    (Protected, Single Book)
   3. POST   /books        (Protected, Add Book)
   4. PATCH  /books/:id    (Protected, Owner Only Edit)
   5. DELETE /books/:id    (Protected, Owner Only Delete)
   6. POST   /borrows      (Protected, Atomic Borrow & Duplicate Check)
   7. GET    /borrows      (Protected, Logged-in User's Borrows Only)
   8. DELETE /borrows/:id  (Protected, Return Book & Atomic Increment)
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. GET /books (Public, query params: sort=newest, limit=6, owner=me)
// --------------------------------------------------------------------------
app.get("/books", optionalAuth, async (req, res) => {
  try {
    const db = await getDb();
    const booksCol = db.collection("books");

    const { sort, limit, owner } = req.query;
    let query = {};

    // owner=me requires authentication
    if (owner === "me") {
      if (!req.user || !req.user.email) {
        return res.status(401).json({
          success: false,
          message: "Authentication required to filter books by owner=me.",
        });
      }
      query.userEmail = req.user.email.toLowerCase();
    }

    let cursor = booksCol.find(query);

    // Sorting
    if (sort === "newest") {
      cursor = cursor.sort({ createdAt: -1 });
    }

    // Limit
    if (limit) {
      cursor = cursor.limit(parseInt(limit, 10));
    }

    const books = await cursor.toArray();
    res.json({ success: true, count: books.length, data: books });
  } catch (error) {
    console.error("GET /books error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve books." });
  }
});

// --------------------------------------------------------------------------
// 2. GET /books/:id (Protected, Single Book)
// --------------------------------------------------------------------------
app.get("/books/:id", authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const booksCol = db.collection("books");
    const { id } = req.params;

    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const book = await booksCol.findOne(query);

    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found." });
    }

    res.json({ success: true, data: book });
  } catch (error) {
    console.error("GET /books/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve book details." });
  }
});

// --------------------------------------------------------------------------
// 3. POST /books (Protected, Add Book including Total Copies)
// --------------------------------------------------------------------------
app.post("/books", authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const booksCol = db.collection("books");

    const {
      title,
      author,
      category,
      image,
      shortDescription,
      longDescription,
      totalCopies,
    } = req.body;

    if (!title || !author || !category || !image || !shortDescription) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, author, category, image, shortDescription.",
      });
    }

    const copies = parseInt(totalCopies, 10);
    if (isNaN(copies) || copies < 1) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be a positive integer (minimum 1).",
      });
    }

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim(),
      image: image.trim(),
      shortDescription: shortDescription.trim(),
      longDescription: longDescription ? longDescription.trim() : shortDescription.trim(),
      totalCopies: copies,
      userName: req.user.name || "Reader",
      userEmail: req.user.email.toLowerCase(),
      createdAt: new Date().toISOString(),
    };

    const result = await booksCol.insertOne(newBook);

    res.status(201).json({
      success: true,
      message: "Book added successfully.",
      data: { _id: result.insertedId, ...newBook },
    });
  } catch (error) {
    console.error("POST /books error:", error);
    res.status(500).json({ success: false, message: "Failed to add book." });
  }
});

// --------------------------------------------------------------------------
// 4. PATCH /books/:id (Protected, Owner Only Edit)
// --------------------------------------------------------------------------
app.patch("/books/:id", authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const booksCol = db.collection("books");
    const { id } = req.params;

    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const existingBook = await booksCol.findOne(query);

    if (!existingBook) {
      return res.status(404).json({ success: false, message: "Book not found." });
    }

    // Owner verification
    if (
      !existingBook.userEmail ||
      existingBook.userEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to edit this book.",
      });
    }

    const updates = {};
    const allowed = [
      "title",
      "author",
      "category",
      "image",
      "shortDescription",
      "longDescription",
      "totalCopies",
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "totalCopies") {
          const val = parseInt(req.body[field], 10);
          if (!isNaN(val) && val >= 0) updates[field] = val;
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    updates.updatedAt = new Date().toISOString();

    await booksCol.updateOne(query, { $set: updates });
    const updatedBook = await booksCol.findOne(query);

    res.json({
      success: true,
      message: "Book updated successfully.",
      data: updatedBook,
    });
  } catch (error) {
    console.error("PATCH /books/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to update book." });
  }
});

// --------------------------------------------------------------------------
// 5. DELETE /books/:id (Protected, Owner Only Delete)
// --------------------------------------------------------------------------
app.delete("/books/:id", authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const booksCol = db.collection("books");
    const { id } = req.params;

    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const existingBook = await booksCol.findOne(query);

    if (!existingBook) {
      return res.status(404).json({ success: false, message: "Book not found." });
    }

    // Owner check
    if (
      !existingBook.userEmail ||
      existingBook.userEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to delete this book.",
      });
    }

    await booksCol.deleteOne(query);

    res.json({ success: true, message: "Book deleted successfully." });
  } catch (error) {
    console.error("DELETE /books/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to delete book." });
  }
});

// --------------------------------------------------------------------------
// 6. POST /borrows (Protected, Atomic Borrow & Duplicate Check)
// --------------------------------------------------------------------------
app.post("/borrows", authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const booksCol = db.collection("books");
    const borrowsCol = db.collection("borrows");

    const { bookId, returnDate } = req.body;

    if (!bookId || !returnDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookId, returnDate.",
      });
    }

    const userEmail = req.user.email.toLowerCase();

    // 1. Duplicate check: Cannot borrow the same book twice
    const activeBorrow = await borrowsCol.findOne({
      bookId,
      userEmail,
    });

    if (activeBorrow) {
      return res.status(400).json({
        success: false,
        message: "You have already borrowed this book.",
      });
    }

    // 2. Fetch book details
    let bookQuery;
    if (ObjectId.isValid(bookId)) {
      bookQuery = { _id: new ObjectId(bookId) };
    } else {
      bookQuery = { _id: bookId };
    }

    const book = await booksCol.findOne(bookQuery);

    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found." });
    }

    // 3. Stock Check
    if (book.totalCopies <= 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot borrow: This book is currently out of stock.",
      });
    }

    // 4. Atomic decrement ($inc: { totalCopies: -1 })
    const decrementResult = await booksCol.updateOne(
      { ...bookQuery, totalCopies: { $gt: 0 } },
      { $inc: { totalCopies: -1 } }
    );

    if (decrementResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Could not reserve copy: Book is out of stock.",
      });
    }

    // 5. Create Borrow Record
    const borrowRecord = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image,
      bookAuthor: book.author,
      bookCategory: book.category,
      userName: req.user.name || "Reader",
      userEmail,
      borrowedAt: new Date().toISOString(),
      returnDate,
    };

    const insertResult = await borrowsCol.insertOne(borrowRecord);

    res.status(201).json({
      success: true,
      message: "Book borrowed successfully.",
      data: { _id: insertResult.insertedId, ...borrowRecord },
    });
  } catch (error) {
    console.error("POST /borrows error:", error);
    res.status(500).json({ success: false, message: "Failed to process borrow request." });
  }
});

// --------------------------------------------------------------------------
// 7. GET /borrows (Protected, Logged-in User's Borrows Only)
// --------------------------------------------------------------------------
app.get("/borrows", authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const borrowsCol = db.collection("borrows");

    const userEmail = req.user.email.toLowerCase();
    const borrows = await borrowsCol
      .find({ userEmail })
      .sort({ borrowedAt: -1 })
      .toArray();

    res.json({ success: true, count: borrows.length, data: borrows });
  } catch (error) {
    console.error("GET /borrows error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve your borrowed collection.",
    });
  }
});

// --------------------------------------------------------------------------
// 8. DELETE /borrows/:id (Protected, Return Book & Atomic Increment)
// --------------------------------------------------------------------------
app.delete("/borrows/:id", authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const borrowsCol = db.collection("borrows");
    const booksCol = db.collection("books");
    const { id } = req.params;

    let borrowQuery;
    if (ObjectId.isValid(id)) {
      borrowQuery = { _id: new ObjectId(id) };
    } else {
      borrowQuery = { _id: id };
    }

    const borrowRecord = await borrowsCol.findOne(borrowQuery);

    if (!borrowRecord) {
      return res.status(404).json({ success: false, message: "Borrow record not found." });
    }

    // Ensure record belongs to the logged-in user
    if (borrowRecord.userEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to return this book.",
      });
    }

    // 1. Delete borrow record
    await borrowsCol.deleteOne(borrowQuery);

    // 2. Atomic increment book copies ($inc: { totalCopies: 1 })
    let bookQuery;
    if (ObjectId.isValid(borrowRecord.bookId)) {
      bookQuery = { _id: new ObjectId(borrowRecord.bookId) };
    } else {
      bookQuery = { _id: borrowRecord.bookId };
    }

    await booksCol.updateOne(bookQuery, { $inc: { totalCopies: 1 } });

    res.json({
      success: true,
      message: "Book returned successfully. Inventory copies incremented.",
    });
  } catch (error) {
    console.error("DELETE /borrows/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to return book." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`BookNook Express Server running on port ${PORT}`);
});
