// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Endpoint to handle initial Google Sign-In check
router.post('/google-login', async (req, res) => {
  const { email, name } = req.body;
  console.log("Received /google-login with:", { email, name });

  if (!email) {
    console.log("Missing email for Google login check.");
    return res.status(400).json({ message: 'Email is required for Google Sign-In check' });
  }

  try {
    // Fetch user, including role and isBlocked status, but exclude photo for efficiency
    let user = await User.findOne({ email }).select('-photo');
    console.log("User found during Google login check?", user ? user._id : 'No user found');

    if (user) {
      // User exists, return their data (excluding photo)
      console.log("User already exists, returning profile (excluding photo).");
      // Ensure all necessary fields are present for the frontend
      return res.status(200).json({
        needsCompletion: false,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          phoneNumber: user.phoneNumber,
          role: user.role, // Include role
          isBlocked: user.isBlocked // Include isBlocked
        }
      });
    } else {
      // User does not exist, signal frontend to ask for completion
      console.log("User does not exist, needs profile completion.");
      return res.status(200).json({
        needsCompletion: true,
        email: email,
        suggestedName: name || '',
      });
    }
  } catch (err) {
    console.error('Google login check error:', err);
    return res.status(500).json({ message: 'Server error during Google Sign-In check' });
  }
});


// Endpoint to complete profile (called ONLY if needsCompletion was true)
router.post('/complete-profile', async (req, res) => {
  const { email, name, photo, phoneNumber } = req.body;
  console.log("Received /complete-profile with:", { email, name, phoneNumber, photo: photo ? 'Base64 present' : 'No photo' });

  if (!email || !name || !phoneNumber || !photo) {
    console.log("Missing required fields for profile completion.");
    return res.status(400).json({ message: 'Email, Name, Phone Number, and Photo are required' });
  }
  if (!/^\d{10}$/.test(phoneNumber)) {
      console.log("Invalid phone number format:", phoneNumber);
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
  }
   if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      console.log("Invalid photo data format provided.");
      return res.status(400).json({ message: 'Invalid photo data format.' });
   }

  try {
    const updatedOrNewUser = await User.findOneAndUpdate(
      { email: email },
      {
        $set: {
          name: name,
          photo: photo,
          phoneNumber: phoneNumber,
          // registrationDate will be set by default if new
        },
        $setOnInsert: {
            email: email,
            role: 'user', // Default role for new users
            isBlocked: false,
            registrationDate: new Date()
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        projection: '-photo' // Exclude photo from the returned document by default
      }
    );

    console.log("Saved/Updated user via complete-profile:", updatedOrNewUser._id);
    // The user object from findOneAndUpdate (with projection) already excludes photo
    return res.status(200).json({
        message: 'User profile created or updated',
        user: { // Ensure consistent user object structure
            _id: updatedOrNewUser._id,
            email: updatedOrNewUser.email,
            name: updatedOrNewUser.name,
            phoneNumber: updatedOrNewUser.phoneNumber,
            role: updatedOrNewUser.role,
            isBlocked: updatedOrNewUser.isBlocked
        }
    });

  } catch (err) {
    console.error('Save profile error:', err);
    if (err.code === 11000) {
      const existingUser = await User.findOne({ email }).select('-photo');
      if (existingUser) {
        return res.status(200).json({ message: 'User already exists (race condition handled)', user: existingUser });
      }
      return res.status(409).json({ message: 'Duplicate email error during save' });
    }
    if (err.name === 'ValidationError') {
       const messages = Object.values(err.errors).map(e => e.message);
       console.log('Validation Errors:', messages);
       return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}` });
    }
    return res.status(500).json({ message: 'Server error while saving profile' });
  }
});

module.exports = router;