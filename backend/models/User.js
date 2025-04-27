// backend/models/user.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true }, // Make name required
  photo: { type: String }, // Photo might be optional
  phoneNumber: { type: String, required: true } // Add phone number, make required
});

module.exports = mongoose.model('User', UserSchema);