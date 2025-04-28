// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth'); // Ensure this path is correct and exports a valid router
const cors = require('cors');
require('dotenv').config();
console.log('Attempting to connect with MONGO_URI:', process.env.MONGO_URI ? 'Loaded' : 'Not Loaded!'); 
const app = express();

app.use(cors());
app.use(express.json()); 


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully')) 
  .catch(err => console.error('MongoDB Connection Error:', err)); 
app.use('/api/auth', authRoutes); // Ensure authRoutes is a valid middleware function

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));