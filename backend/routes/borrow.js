// backend/routes/borrow.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BorrowingRecord = require('../models/BorrowingRecord');
const Book = require('../models/Book');
const User = require('../models/User'); // Ensure User model is imported if needed for validation

const MAX_BORROW_LIMIT = 3;

// --- Helper: Get Active Borrows Count ---
async function getUserBorrowCount(userId, session = null) {
    // Ensure userId is valid before querying
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`Invalid userId format passed to getUserBorrowCount: ${userId}`);
        return 0; // Or throw an error, depending on desired handling
    }
    // Use session if provided for transactional consistency
    return await BorrowingRecord.countDocuments({ userId: userId, status: 'borrowed' }).session(session);
}

// --- GET Borrow Status for a specific book/user ---
router.get('/status/:bookMongoId/:userId', async (req, res) => {
    const { bookMongoId, userId } = req.params;
    console.log(`GET /status/${bookMongoId}/${userId}`);

    if (!mongoose.Types.ObjectId.isValid(bookMongoId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid Book or User ID format' });
    }

    try {
        // 1. Check if the user has *already* borrowed this specific book and it's active
        const existingRecord = await BorrowingRecord.findOne({
            bookRef: bookMongoId,
            userId: userId,
            status: 'borrowed'
        }).lean(); // Use .lean() for read-only performance if not modifying

        const borrowCount = await getUserBorrowCount(userId); // Get current borrow count

        if (existingRecord) {
            // User has this book borrowed
            return res.status(200).json({
                status: 'borrowedByUser',
                recordId: existingRecord._id,
                borrowCount: borrowCount
            });
        }

        // 2. If not borrowed by this user, check book availability and user's limit
        const book = await Book.findById(bookMongoId).select('availableCopies copies').lean();
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        let finalStatus;
        if (book.availableCopies > 0) {
            if (borrowCount >= MAX_BORROW_LIMIT) {
                finalStatus = 'limitReached';
            } else {
                finalStatus = 'canBorrow';
            }
        } else {
            finalStatus = 'unavailable'; // Book has no available copies left for anyone
        }

        res.status(200).json({
            status: finalStatus,
            recordId: null, // No active record for *this* user and *this* book
            borrowCount: borrowCount
        });

    } catch (err) {
        console.error('Error fetching borrow status:', err);
        res.status(500).json({ message: 'Server error fetching borrow status' });
    }
});


// --- GET User Borrow Count ---
// This endpoint might be redundant now that GET /status includes the count,
// but keeping it in case it's used elsewhere or for future needs.
router.get('/user/:userId/count', async (req, res) => {
    const { userId } = req.params;
    console.log(`GET /user/${userId}/count`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }

    try {
        const count = await getUserBorrowCount(userId);
        res.status(200).json({ borrowCount: count });
    } catch (err) {
        console.error('Error fetching user borrow count:', err);
        res.status(500).json({ message: 'Server error fetching borrow count' });
    }
});

// --- GET Active Borrows for a User (NEW for MyBorrows page) ---
router.get('/user/:userId/active', async (req, res) => {
    const { userId } = req.params;
    console.log(`GET /user/${userId}/active - Fetching active borrows`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }

    try {
        const activeBorrows = await BorrowingRecord.find({
            userId: userId,
            status: 'borrowed'
        })
        .populate('bookRef', 'title author image') // Populate book details
        .sort({ borrowDate: -1 }) // Optional: Sort by borrow date
        .lean(); // Use lean for read-only performance

        console.log(`Found ${activeBorrows.length} active borrows for user ${userId}`);
        res.status(200).json(activeBorrows);

    } catch (err) {
        console.error('Error fetching active borrows:', err);
        res.status(500).json({ message: 'Server error fetching active borrows' });
    }
});


// --- POST Borrow a Book ---
router.post('/:bookMongoId', async (req, res) => {
    const { bookMongoId } = req.params;
    const { userId, borrowImages } = req.body;
    console.log(`POST /borrow/${bookMongoId} for user ${userId}`);

    // --- Input Validations ---
    if (!mongoose.Types.ObjectId.isValid(bookMongoId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid Book or User ID format' });
    }
    if (!Array.isArray(borrowImages) || borrowImages.length !== 4) {
        return res.status(400).json({ message: 'Exactly 4 borrow images are required' });
    }
    if (borrowImages.some(img => typeof img !== 'string' || !img.startsWith('data:image'))) {
        return res.status(400).json({ message: 'Invalid image data format' });
    }

    // --- Transaction ---
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // 1. Verify User Exists
        const user = await User.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. Atomically Find and Decrement Book Copy (if available)
        const updatedBook = await Book.findOneAndUpdate(
            { _id: bookMongoId, availableCopies: { $gt: 0 } }, // Condition: Book exists AND has copies
            { $inc: { availableCopies: -1 } },                // Action: Decrement count
            { new: true, session }                            // Options: Return updated doc, use session
        );

        // Check if the update succeeded (i.e., book was found and had copies)
        if (!updatedBook) {
             await session.abortTransaction(); session.endSession();
             // Check *why* it failed (was it not found, or just no copies?)
             const bookExists = await Book.findById(bookMongoId).select('_id').lean().session(session);
             if (!bookExists) {
                 return res.status(404).json({ message: 'Book not found.' });
             } else {
                 return res.status(409).json({ message: 'Book is currently unavailable for borrowing.' }); // 409 Conflict is suitable here
             }
        }

        // 3. Check Borrow Limit *after* securing a copy
        // Pass session to helper for transactional read
        const currentBorrows = await getUserBorrowCount(userId, session);
        if (currentBorrows >= MAX_BORROW_LIMIT) {
             // Rollback the decrement since the user hit the limit
             await Book.findByIdAndUpdate(bookMongoId, { $inc: { availableCopies: 1 } }, { session });
             await session.abortTransaction(); session.endSession();
             return res.status(400).json({ message: `Borrow limit of ${MAX_BORROW_LIMIT} books reached` });
        }

        // 4. Create Borrowing Record (Unique index handles "already borrowed" check)
        const borrowDate = new Date();
        const returnDate = new Date(borrowDate);
        returnDate.setDate(borrowDate.getDate() + 15); // Example: 15-day loan

        const newRecord = new BorrowingRecord({
            userId,
            bookRef: updatedBook._id,        // Use the ObjectId reference
            bookStringId: updatedBook.bookid, // Store the original string ID if needed
            borrowDate,
            returnDate,
            borrowImages,
            status: 'borrowed',
        });

        await newRecord.save({ session }); // Save within the transaction

        // 5. Commit Transaction
        await session.commitTransaction();
        console.log(`Book ${bookMongoId} borrowed successfully by ${userId}. Record ID: ${newRecord._id}`);
        res.status(201).json({ message: 'Book borrowed successfully', record: newRecord });

    } catch (err) {
        await session.abortTransaction(); // Rollback on any error
        console.error('Error borrowing book:', err);

        // Specific error handling
        if (err.code === 11000) { // Duplicate key error (likely from the unique index)
            return res.status(409).json({ message: 'You have already borrowed this book.' });
        }
        if (err.name === 'ValidationError') {
             console.error('Validation Error Details:', err.errors);
             const messages = Object.values(err.errors).map(e => e.message);
             return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}` });
         }

        // Generic server error
        res.status(500).json({ message: err.message || 'Server error during borrowing process' });
    } finally {
         // Ensure the session always ends
        session.endSession();
    }
});


// --- POST Return a Book ---
router.post('/return/:recordId', async (req, res) => {
    const { recordId } = req.params;
    const { userId, returnImages } = req.body;
    console.log(`POST /return/${recordId} for user ${userId}`);

    // --- Input Validations ---
    if (!mongoose.Types.ObjectId.isValid(recordId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid Record or User ID format' });
    }
    if (!Array.isArray(returnImages) || returnImages.length !== 4) {
        return res.status(400).json({ message: 'Exactly 4 return images are required' });
    }
    if (returnImages.some(img => typeof img !== 'string' || !img.startsWith('data:image'))) {
        return res.status(400).json({ message: 'Invalid image data format' });
    }

    // --- Transaction ---
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // 1. Find the specific borrowing record to return
        const record = await BorrowingRecord.findById(recordId).session(session);
        if (!record) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Borrowing record not found' });
        }

        // 2. Authorization & Status Checks
        if (record.userId.toString() !== userId) {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ message: 'You are not authorized to return this book' });
        }
        if (record.status === 'returned') {
            await session.abortTransaction(); session.endSession();
            // It's debatable whether this is an error (400) or just informational (200 OK)
            // Let's use 400 Bad Request as the action cannot be performed again.
            return res.status(400).json({ message: 'This book has already been returned' });
        }

        // 3. Update the Borrowing Record
        record.status = 'returned';
        record.actualReturnDate = new Date();
        record.returnImages = returnImages;
        await record.save({ session }); // Save changes within the transaction

        // 4. Increment the Book's Available Copies Count
        // Use bookRef (the ObjectId) to find the book
        const returnedBook = await Book.findByIdAndUpdate(record.bookRef,
            { $inc: { availableCopies: 1 } },
            { new: true, session } // Return updated doc, use session
        );

        if (!returnedBook) {
            // This indicates a data inconsistency (record exists, but book doesn't).
            // Log a critical error, but maybe don't abort the transaction?
            // Aborting means the user can't mark the book as returned, which might be worse.
            // Let's commit the return status update but log this inconsistency.
            console.error(`CRITICAL: Book with id ${record.bookRef} referenced in record ${recordId} not found during return, but proceeding with marking record as returned.`);
            // If you *must* ensure atomicity even if the book is gone:
            // await session.abortTransaction(); session.endSession();
            // return res.status(500).json({ message: 'Data inconsistency: Book not found during return process.' });
        }

        // 5. Commit Transaction
        await session.commitTransaction();
        console.log(`Book record ${recordId} returned successfully by ${userId}`);
        res.status(200).json({ message: 'Book returned successfully', record }); // Send back the updated record

    } catch (err) {
        await session.abortTransaction(); // Rollback on any error
        console.error('Error returning book:', err);
         if (err.name === 'ValidationError') {
             console.error('Validation Error Details:', err.errors);
             const messages = Object.values(err.errors).map(e => e.message);
             return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}` });
         }
        res.status(500).json({ message: err.message || 'Server error during return process' });
    } finally {
         // Ensure the session always ends
        session.endSession();
    }
});


module.exports = router;