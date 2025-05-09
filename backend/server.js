// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const borrowRoutes = require('./routes/borrow');
const adminRoutes = require('./routes/admin'); // <-- Import admin routes

// Ensure models are registered (Mongoose handles this, but good to list them)
require('./models/User');
require('./models/Book');
require('./models/BorrowingRecord');


console.log('Attempting to connect with MONGO_URI:', process.env.MONGO_URI ? 'Loaded' : 'Not Loaded!');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/admin', adminRoutes); // <-- Use admin routes

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));