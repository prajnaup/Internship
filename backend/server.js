// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books'); // <-- Import book routes
const User = require('./models/User'); // Ensure User model is correctly imported if needed here
const Book = require('./models/Book'); // Ensure Book model is correctly imported if needed here


console.log('Attempting to connect with MONGO_URI:', process.env.MONGO_URI ? 'Loaded' : 'Not Loaded!');
const app = express();

app.use(cors());
app.use(express.json());


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes); // <-- Use book routes with '/api/books' prefix

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));