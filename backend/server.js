// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const cors = require('cors');
require('dotenv').config();
console.log('Attempting to connect with MONGO_URI:', process.env.MONGO_URI ? 'Loaded' : 'Not Loaded!'); // Check if loaded

const app = express();

app.use(cors());
app.use(express.json()); // Ensure this is before your routes

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  authSource: 'admin', // Keep if needed for Atlas auth user
  // useNewUrlParser: true,  // Deprecated - Remove
  // useUnifiedTopology: true // Deprecated - Remove
})
  .then(() => console.log('MongoDB Connected Successfully')) // More positive confirmation
  .catch(err => console.error('MongoDB Connection Error:', err)); // More specific error log

// Routes
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));