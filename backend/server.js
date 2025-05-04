// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const borrowRoutes = require('./routes/borrow'); // <-- Import borrow routes
const User = require('./models/User');
const Book = require('./models/Book');
const BorrowingRecord = require('./models/BorrowingRecord'); // <-- Ensure model is registered


console.log('Attempting to connect with MONGO_URI:', process.env.MONGO_URI ? 'Loaded' : 'Not Loaded!');
const app = express();

app.use(cors());
// Increase payload size limit for Base64 images - adjust as needed, but be mindful of performance/memory
app.use(express.json({ limit: '50mb' })); // Example: 50MB limit
app.use(express.urlencoded({ limit: '50mb', extended: true }));


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/borrow', borrowRoutes); // <-- Use borrow routes

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));