// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  // Store the captured photo as a Base64 data URI string.
  // WARNING: Storing large Base64 strings directly in MongoDB can impact performance and hit document size limits (16MB).
  // Consider external storage (like S3) or GridFS for production applications with high-resolution images.
  photo: {
    type: String,
    required: [true, 'User photo is required.'],
    validate: {
        validator: function(v) {
            // Basic check for data URI format (can be improved)
            return typeof v === 'string' && v.startsWith('data:image/');
        },
        message: 'Invalid photo data format.'
    }
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required.'],
    // Add validation for 10 digits
    validate: {
        validator: function(v) {
            // Basic check for 10 digits
            return typeof v === 'string' && /^\d{10}$/.test(v);
        },
        message: props => `${props.value} is not a valid 10-digit phone number!`
    }
   }
});

// Prevent OverwriteModelError by checking if the model already exists
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);