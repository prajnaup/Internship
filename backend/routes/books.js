// backend/routes/books.js
const express = require('express');
const router = express.Router();
const Book = require('../models/Book'); // Adjust path if needed

// GET /api/books - Fetch all books (or a subset for pagination later)
router.get('/', async (req, res) => {
  console.log("GET /api/books request received");
  try {
    // Fetch books, maybe limit the number initially
    const books = await Book.find({})
                           .select('title author image _id') // Select only needed fields for home display
                           .limit(20); // Example: Limit to 20 books for performance

    console.log(`Found ${books.length} books`);
    res.status(200).json(books);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).json({ message: 'Server error while fetching books' });
  }
});

// Optional: GET /api/books/:id - Fetch a single book's details (for later use)
router.get('/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        // Add .populate('reviews.userId', 'name') if you need reviewer names
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