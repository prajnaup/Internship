// backend/routes/borrow.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BorrowingRecord = require('../models/BorrowingRecord');
const Book = require('../models/Book');
const User = require('../models/User');

const MAX_BORROW_LIMIT = 3;

async function getUserBorrowCount(userId, session = null) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`Invalid userId format passed to getUserBorrowCount: ${userId}`);
        return 0;
    }
    return await BorrowingRecord.countDocuments({ userId: userId, status: 'borrowed' }).session(session);
}

router.get('/status/:bookMongoId/:userId', async (req, res) => {
    const { bookMongoId, userId } = req.params;
    console.log(`GET /status/${bookMongoId}/${userId}`);

    if (!mongoose.Types.ObjectId.isValid(bookMongoId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid Book or User ID format' });
    }

    try {
        const user = await User.findById(userId).select('isBlocked').lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.isBlocked) {
            return res.status(200).json({ // Still 200, but with a status indicating blockage
                status: 'userBlocked',
                recordId: null,
                borrowCount: 0 // Or fetch actual count if needed for display even when blocked
            });
        }

        const existingRecord = await BorrowingRecord.findOne({
            bookRef: bookMongoId,
            userId: userId,
            status: 'borrowed'
        }).lean();

        const borrowCount = await getUserBorrowCount(userId);

        if (existingRecord) {
            return res.status(200).json({
                status: 'borrowedByUser',
                recordId: existingRecord._id,
                borrowCount: borrowCount
            });
        }

        const book = await Book.findById(bookMongoId).select('availableCopies').lean();
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
            finalStatus = 'unavailable';
        }

        res.status(200).json({
            status: finalStatus,
            recordId: null,
            borrowCount: borrowCount
        });

    } catch (err) {
        console.error('Error fetching borrow status:', err);
        res.status(500).json({ message: 'Server error fetching borrow status' });
    }
});

router.get('/user/:userId/count', async (req, res) => {
    // ... (keep existing logic or deprecate if /status is sufficient)
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }
    try {
        const count = await getUserBorrowCount(userId);
        res.status(200).json({ borrowCount: count });
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching borrow count' });
    }
});

router.get('/user/:userId/active', async (req, res) => {
    // ... (keep existing logic)
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }
    try {
        const activeBorrows = await BorrowingRecord.find({ userId: userId, status: 'borrowed' })
            .populate('bookRef', 'title author image bookid')
            .sort({ returnDate: 1 })
            .lean();
        res.status(200).json(activeBorrows);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching active borrows' });
    }
});

router.get('/user/:userId/history', async (req, res) => {
    // ... (keep existing logic)
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }
    try {
        const borrowHistory = await BorrowingRecord.find({ userId: userId, status: 'returned'})
            .populate('bookRef', 'title author image bookid')
            .sort({ actualReturnDate: -1 })
            .lean();
        res.status(200).json(borrowHistory);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching borrow history' });
    }
});


router.post('/:bookMongoId', async (req, res) => {
    const { bookMongoId } = req.params;
    const { userId, borrowImages } = req.body;
    console.log(`POST /borrow/${bookMongoId} for user ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(bookMongoId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid Book or User ID format' });
    }
    // ... (image validations remain)
    if (!Array.isArray(borrowImages) || borrowImages.length !== 4) {
        return res.status(400).json({ message: 'Exactly 4 borrow images are required' });
    }
    if (borrowImages.some(img => typeof img !== 'string' || !img.startsWith('data:image'))) {
        return res.status(400).json({ message: 'Invalid image data format' });
    }


    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // 1. Verify User Exists AND IS NOT BLOCKED
        const user = await User.findById(userId).select('isBlocked').session(session);
        if (!user) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.isBlocked) {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ message: 'You are blocked from borrowing books due to overdue returns. Please return overdue books to resume access.' });
        }

        // ... (rest of the borrowing logic remains the same)
        // 2. Atomically Find and Decrement Book Copy
        const updatedBook = await Book.findOneAndUpdate(
            { _id: bookMongoId, availableCopies: { $gt: 0 } },
            { $inc: { availableCopies: -1 } },
            { new: true, session }
        );

        if (!updatedBook) {
             await session.abortTransaction(); session.endSession();
             const bookExists = await Book.findById(bookMongoId).select('_id').lean().session(session);
             if (!bookExists) {
                 return res.status(404).json({ message: 'Book not found.' });
             } else {
                 return res.status(409).json({ message: 'Book is currently unavailable for borrowing.' });
             }
        }

        // 3. Check Borrow Limit
        const currentBorrows = await getUserBorrowCount(userId, session);
        if (currentBorrows >= MAX_BORROW_LIMIT) {
             await Book.findByIdAndUpdate(bookMongoId, { $inc: { availableCopies: 1 } }, { session });
             await session.abortTransaction(); session.endSession();
             return res.status(400).json({ message: `Borrow limit of ${MAX_BORROW_LIMIT} books reached` });
        }
        
        // 4. Create Borrowing Record
        const borrowDate = new Date();
        const returnDate = new Date(borrowDate);
        returnDate.setDate(borrowDate.getDate() + 15);

        const newRecord = new BorrowingRecord({
            userId,
            bookRef: updatedBook._id,
            bookStringId: updatedBook.bookid,
            borrowDate,
            returnDate,
            borrowImages,
            status: 'borrowed',
        });
        await newRecord.save({ session });

        // 5. Commit Transaction
        await session.commitTransaction();
        console.log(`Book ${bookMongoId} borrowed successfully by ${userId}. Record ID: ${newRecord._id}`);
        res.status(201).json({ message: 'Book borrowed successfully', record: newRecord });

    } catch (err) {
        await session.abortTransaction();
        console.error('Error borrowing book:', err);
        if (err.code === 11000) {
            if (mongoose.Types.ObjectId.isValid(bookMongoId)) {
                 // Start a new session for this independent rollback if the original one is already aborted
                const rollbackSession = await mongoose.startSession();
                try {
                    await Book.findByIdAndUpdate(bookMongoId, { $inc: { availableCopies: 1 } }, { session: rollbackSession });
                } finally {
                    rollbackSession.endSession();
                }
            }
            return res.status(409).json({ message: 'You have already borrowed this book.' });
        }
        if (err.name === 'ValidationError') {
             const messages = Object.values(err.errors).map(e => e.message);
             return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}` });
         }
        res.status(500).json({ message: err.message || 'Server error during borrowing process' });
    } finally {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
    }
});


router.post('/return/:recordId', async (req, res) => {
    // ... (keep existing return logic)
    // No changes needed here based on the new requirements for admin specifically,
    // as returning a book is a standard user action.
    const { recordId } = req.params;
    const { userId, returnImages } = req.body;
    if (!mongoose.Types.ObjectId.isValid(recordId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid Record or User ID format' });
    }
     if (!Array.isArray(returnImages) || returnImages.length !== 4) {
        return res.status(400).json({ message: 'Exactly 4 return images are required' });
    }
    if (returnImages.some(img => typeof img !== 'string' || !img.startsWith('data:image'))) {
        return res.status(400).json({ message: 'Invalid image data format' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const record = await BorrowingRecord.findById(recordId).session(session);
        if (!record) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Borrowing record not found' });
        }
        if (record.userId.toString() !== userId) {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ message: 'You are not authorized to return this book' });
        }
        if (record.status === 'returned') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'This book has already been returned' });
        }

        record.status = 'returned';
        record.actualReturnDate = new Date();
        record.returnImages = returnImages;
        await record.save({ session });

        const returnedBook = await Book.findByIdAndUpdate(record.bookRef,
            { $inc: { availableCopies: 1 } },
            { new: true, session }
        );

        if (!returnedBook) {
            console.error(`CRITICAL: Book with id ${record.bookRef} referenced in record ${recordId} not found during return.`);
        }
        await session.commitTransaction();
        res.status(200).json({ message: 'Book returned successfully', record });

    } catch (err) {
        await session.abortTransaction();
        console.error('Error returning book:', err);
         if (err.name === 'ValidationError') {
             const messages = Object.values(err.errors).map(e => e.message);
             return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}` });
         }
        res.status(500).json({ message: err.message || 'Server error during return process' });
    } finally {
        session.endSession();
    }
});

module.exports = router;