// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  photo: {
    type: String,
    required: [true, 'User photo is required.'],
    validate: {
        validator: function(v) {
            return typeof v === 'string' && v.startsWith('data:image/');
        },
        message: 'Invalid photo data format.'
    }
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required.'],
    validate: {
        validator: function(v) {
            return typeof v === 'string' && /^\d{10}$/.test(v);
        },
        message: props => `${props.value} is not a valid 10-digit phone number!`
    }
   },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false,
    required: true
  },
  registrationDate: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { timestamps: true }); // Add createdAt, updatedAt

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);