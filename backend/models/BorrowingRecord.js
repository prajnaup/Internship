// backend/models/BorrowingRecord.js
// ... (Previous content remains the same, ensure indexes are set up)
const mongoose = require('mongoose');

const borrowingRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Use 'bookRef' to store the ObjectId reference to the Book document
  bookRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  // Store the original string bookid if you need it for display or other non-relational lookups
  bookStringId: { type: String, required: true },
  borrowDate: { type: Date, default: Date.now, required: true },
  returnDate: { type: Date, required: true }, // Due date
  actualReturnDate: { type: Date, default: null },
  // WARNING: Storing large Base64 strings here can hit MongoDB limits. Consider GridFS or external storage.
  borrowImages: { type: [String], required: true, validate: [arr => arr.length === 4, 'Must provide exactly 4 borrow images'] },
  returnImages: { type: [String], default: [], validate: [arr => arr.length === 0 || arr.length === 4, 'Must provide exactly 4 return images if returning'] },
  status: { type: String, enum: ['borrowed', 'returned'], default: 'borrowed', required: true, index: true }
}, { timestamps: true }); // Add createdAt/updatedAt automatically

// Index for efficient user borrow count checks
borrowingRecordSchema.index({ userId: 1, status: 1 });
// Index for checking if a user has already borrowed a specific book (using the ObjectId ref)
// Make sure the combination of user and borrowed book is unique WHEN the status is 'borrowed'
borrowingRecordSchema.index({ userId: 1, bookRef: 1, status: 1 }, {
    unique: true,
    partialFilterExpression: { status: 'borrowed' } // Apply uniqueness constraint only for 'borrowed' records
});


module.exports = mongoose.model('BorrowingRecord', borrowingRecordSchema);