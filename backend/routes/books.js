// backend/routes/books.js
const express = require('express');
const router = express.Router();
const Book = require('../models/Book');

// GET /api/books - Fetch **available** books for homepage
router.get('/', async (req, res) => {
  console.log("GET /api/books request received (fetching available books)");
  try {
    // Fetch including the bookid field explicitly
    const books = await Book.find({ availableCopies: { $gt: 0 } })
                           // Ensure bookid is selected
                           .select('title author image _id availableCopies bookid')
                           .limit(20) // Example limit
                           .lean(); // Use lean for plain JS objects

    console.log(`Found ${books.length} available books for homepage. Sample:`, books[0]); // Log first book to check structure
    res.status(200).json(books);
  } catch (err) {
    console.error('Error fetching available books:', err);
    res.status(500).json({ message: 'Server error while fetching books' });
  }
});

// GET /api/books/:id - Fetch a single book's details (remains unchanged)
router.get('/:id', async (req, res) => {
    try {
        // Fetching full document here, so bookid will be included
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.status(200).json(book);
    } catch (err) {
        console.error('Error fetching single book:', err);
        if (err.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Invalid book ID format' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;