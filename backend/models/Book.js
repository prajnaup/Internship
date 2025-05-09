// backend/models/Book.js
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  bookid: { type: String, required: true, unique: true },
  author: { type: String, required: true },
  genre: { type: String, required: true },
  about: { type: String }, // Added about field
  image: { type: String, required: true },
  copies: { type: Number, required: true, default: 1 },
  availableCopies: { type: Number, required: true, default: 1 }
});


module.exports = mongoose.model('Book', bookSchema);