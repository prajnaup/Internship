// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAdmin } = require('../middleware/authMiddleware');
const Book = require('../models/Book');
const User = require('../models/User');
const BorrowingRecord = require('../models/BorrowingRecord');

// Middleware: All routes in this file require admin access
router.use(isAdmin);

// --- Book Management ---
// GET /api/admin/books - Fetch ALL books for admin view
router.get('/books', async (req, res) => {
    console.log("GET /api/admin/books request received (fetching all books for admin)");
    try {
        const books = await Book.find({}) // Find all books
                           .select('title author genre image _id availableCopies copies bookid about') // Ensure all needed fields, including 'about'
                           .sort({ title: 1 }) // Optional: sort by title
                           .lean();

        console.log(`Found ${books.length} total books for admin view.`);
        res.status(200).json(books);
    } catch (err) {
        console.error('Error fetching all books for admin:', err);
        res.status(500).json({ message: 'Server error while fetching all books for admin' });
    }
});

// POST /api/admin/books/add
router.post('/books/add', async (req, res) => {
    const { title, bookid, author, genre, about, image, copies } = req.body; // Added 'about'
    if (!title || !bookid || !author || !genre || !image || copies == null) {
        return res.status(400).json({ message: 'Missing required book fields.' });
    }
    const parsedCopies = parseInt(copies);
    if (isNaN(parsedCopies) || parsedCopies < 0) {
        return res.status(400).json({ message: 'Copies must be a non-negative number.' });
    }

    try {
        const existingBook = await Book.findOne({ bookid: bookid });
        if (existingBook) {
            return res.status(409).json({ message: 'Book with this Book ID already exists.' });
        }

        const newBook = new Book({
            title,
            bookid,
            author,
            genre,
            about: about || '', // Save 'about' field
            image,
            copies: parsedCopies,
            availableCopies: parsedCopies // Initially, all copies are available
        });
        await newBook.save();
        res.status(201).json({ message: 'Book added successfully', book: newBook });
    } catch (err) {
        console.error('Error adding book:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation failed: ${Object.values(err.errors).map(e => e.message).join(', ')}` });
        }
        res.status(500).json({ message: 'Server error adding book.' });
    }
});

// PUT /api/admin/books/edit/:bookId
router.put('/books/edit/:bookId', async (req, res) => {
    const { bookId } = req.params;
    const updateData = req.body; // Get all update data

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ message: 'Invalid Book MongoDB ID format.' });
    }

    try {
        const book = await Book.findById(bookId);
        if (!book) {
            return res.status(404).json({ message: 'Book not found.' });
        }

        // If bookid is being changed, check for uniqueness
        if (updateData.bookid && updateData.bookid !== book.bookid) {
            const existingBookWithNewId = await Book.findOne({ bookid: updateData.bookid, _id: { $ne: bookId } });
            if (existingBookWithNewId) {
                return res.status(409).json({ message: 'Another book with this Book ID already exists.' });
            }
            book.bookid = updateData.bookid;
        }

        // Update other fields if provided
        if (updateData.title != null) book.title = updateData.title;
        if (updateData.author != null) book.author = updateData.author;
        if (updateData.genre != null) book.genre = updateData.genre;
        if (updateData.about != null) book.about = updateData.about; // Update 'about'
        if (updateData.image != null) book.image = updateData.image;

        const oldTotalCopies = book.copies;
        let newTotalCopies = book.copies;
        let newAvailableCopies = book.availableCopies;

        if (updateData.copies != null) {
            const parsedCopies = parseInt(updateData.copies);
            if (isNaN(parsedCopies) || parsedCopies < 0) {
                return res.status(400).json({ message: 'Copies must be a non-negative number.' });
            }
            newTotalCopies = parsedCopies;
        }

        if (updateData.availableCopies != null) {
            const parsedAvailableCopies = parseInt(updateData.availableCopies);
            if (isNaN(parsedAvailableCopies) || parsedAvailableCopies < 0) {
                return res.status(400).json({ message: 'Available copies must be a non-negative number.' });
            }
            newAvailableCopies = parsedAvailableCopies;
        } else if (updateData.copies != null) {
            // If only total copies is changing, adjust available copies proportionally
            // to the change in total copies, ensuring it doesn't go below zero.
            const diff = newTotalCopies - oldTotalCopies;
            newAvailableCopies = Math.max(0, book.availableCopies + diff);
        }
        
        // Final validation: availableCopies cannot exceed totalCopies
        if (newAvailableCopies > newTotalCopies) {
            // This case should ideally be caught by frontend validation too,
            // but as a safeguard, or if admin is trying to set available > total directly.
             // If this happens, it might imply an issue or the admin intends available to be capped at new total.
            // For now, let's cap it. A more complex scenario might involve erroring.
            console.warn(`Attempt to set availableCopies (${newAvailableCopies}) greater than totalCopies (${newTotalCopies}). Capping availableCopies.`);
            newAvailableCopies = newTotalCopies;
        }
        
        book.copies = newTotalCopies;
        book.availableCopies = newAvailableCopies;

        await book.save();
        res.status(200).json({ message: 'Book updated successfully', book });
    } catch (err) {
        console.error('Error updating book:', err);
         if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation failed: ${Object.values(err.errors).map(e => e.message).join(', ')}` });
        }
        res.status(500).json({ message: 'Server error updating book.' });
    }
});

// DELETE /api/admin/books/delete/:bookId
router.delete('/books/delete/:bookId', async (req, res) => {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ message: 'Invalid Book MongoDB ID format.' });
    }
    try {
        const isBorrowed = await BorrowingRecord.findOne({ bookRef: bookId, status: 'borrowed' });
        if (isBorrowed) {
            return res.status(400).json({ message: 'Cannot delete book. It is currently borrowed by one or more users.' });
        }

        const book = await Book.findByIdAndDelete(bookId);
        if (!book) {
            return res.status(404).json({ message: 'Book not found.' });
        }
        res.status(200).json({ message: 'Book deleted successfully.' });
    } catch (err) {
        console.error('Error deleting book:', err);
        res.status(500).json({ message: 'Server error deleting book.' });
    }
});

// --- User Management ---
// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}).select('-photo').sort({ registrationDate: -1 }).lean();
        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server error fetching users.' });
    }
});

// POST /api/admin/users/block/:userId
router.post('/users/block/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }
    try {
        const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true }).select('-photo');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json({ message: 'User blocked successfully.', user });
    } catch (err) {
        res.status(500).json({ message: 'Server error blocking user.' });
    }
});

// POST /api/admin/users/unblock/:userId
router.post('/users/unblock/:userId', async (req, res) => {
    const { userId } = req.params;
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }
    try {
        const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true }).select('-photo');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json({ message: 'User unblocked successfully.', user });
    } catch (err) {
        res.status(500).json({ message: 'Server error unblocking user.' });
    }
});

// GET /api/admin/users/:userId/borrows
router.get('/users/:userId/borrows', async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }
    try {
        const records = await BorrowingRecord.find({ userId })
            .populate('bookRef', 'title author image bookid')
            .sort({ borrowDate: -1 }) // Most recent first
            .lean();
        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching user borrow details.' });
    }
});


// --- Overdue Users ---
// GET /api/admin/overdue-users
router.get('/overdue-users', async (req, res) => {
    try {
        const overdueRecords = await BorrowingRecord.find({
            status: 'borrowed',
            returnDate: { $lt: new Date() } 
        })
        .populate('userId', 'name email phoneNumber photo isBlocked') 
        .populate('bookRef', 'title author image bookid') 
        .sort({ returnDate: 1 }) 
        .lean();

        res.status(200).json(overdueRecords);
    } catch (err) {
        console.error('Error fetching overdue users:', err);
        res.status(500).json({ message: 'Server error fetching overdue users.' });
    }
});


module.exports = router;