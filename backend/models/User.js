const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  photo: { type: String, required: true },
  phoneNumber: { type: String, required: true }
});

// Prevent OverwriteModelError by checking if the model already exists
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);