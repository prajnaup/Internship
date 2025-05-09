// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Fixed case-sensitive import

// Endpoint to handle initial Google Sign-In check
router.post('/google-login', async (req, res) => {
  const { email, name, picture } = req.body; // Picture from Google is not used for profile completion anymore
  console.log("Received /google-login with:", { email, name, picture: 'Google picture received but not used directly' });

  if (!email) {
    console.log("Missing email for Google login check.");
    return res.status(400).json({ message: 'Email is required for Google Sign-In check' });
  }

  try {
    // Find user, but DO NOT return the photo Base64 string here for efficiency
    // The frontend only needs _id, email, name, potentially phone number during login check
    let user = await User.findOne({ email }).select('-photo'); // Exclude photo from this initial check
    console.log("User found during Google login check?", user ? user._id : 'No user found');

    if (user) {
      // User exists, return their data (excluding photo)
      console.log("User already exists, returning profile (excluding photo).");
      return res.status(200).json({ needsCompletion: false, user }); // Return existing user data (without photo)
    } else {
      // User does not exist, signal frontend to ask for completion
      console.log("User does not exist, needs profile completion.");
      return res.status(200).json({ // Use 200 OK, but signal action needed
        needsCompletion: true,
        email: email,
        suggestedName: name || '',   // Send suggestions for the form
        // Don't suggest Google picture here, user needs to capture a new one
        suggestedPhoto: ''
      });
    }
  } catch (err) {
    console.error('Google login check error:', err);
    return res.status(500).json({ message: 'Server error during Google Sign-In check' });
  }
});


// Endpoint to complete profile (called ONLY if needsCompletion was true)
router.post('/complete-profile', async (req, res) => {
  // Photo is now expected as Base64 data URI
  const { email, name, photo, phoneNumber } = req.body;
  console.log("Received /complete-profile with:", { email, name, phoneNumber, photo: photo ? 'Base64 present' : 'No photo' });

  // --- Backend Validation ---
  if (!email || !name || !phoneNumber || !photo) {
    console.log("Missing required fields for profile completion.");
    return res.status(400).json({ message: 'Email, Name, Phone Number, and Photo are required' });
  }

  // **NEW**: Validate phone number format (10 digits) - Server-side check as well
  if (!/^\d{10}$/.test(phoneNumber)) {
      console.log("Invalid phone number format:", phoneNumber);
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
  }

  // **NEW**: Basic validation for Base64 photo data URI
   if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      console.log("Invalid photo data format provided.");
      return res.status(400).json({ message: 'Invalid photo data format.' });
   }
   // Add a check for reasonable size (e.g., > 10KB, < 10MB) to prevent abuse?
   // const photoSizeInBytes = Buffer.from(photo.split(',')[1], 'base64').length;
   // if (photoSizeInBytes < 10000 || photoSizeInBytes > 10 * 1024 * 1024) {
   //    return res.status(400).json({ message: 'Photo size is outside acceptable limits.' });
   // }

  try {
    // Use findOneAndUpdate with upsert: true as before
    const updatedOrNewUser = await User.findOneAndUpdate(
      { email: email }, // Find user by email
      {
        $set: { // Set these fields
          name: name,
          photo: photo, // Store the Base64 string
          phoneNumber: phoneNumber
        },
        $setOnInsert: { email: email } // Set email only if creating (inserting)
      },
      {
        new: true, // Return the modified document (or new one)
        upsert: true,
        runValidators: true // Run schema validators (including phone and photo format)
      }
    );

    console.log("Saved/Updated user via complete-profile:", updatedOrNewUser._id);
    // **IMPORTANT**: Exclude the large photo field from the response sent back to the client
    // The client already has the photo or doesn't need it immediately after saving.
    const userResponse = updatedOrNewUser.toObject(); // Convert to plain object
    delete userResponse.photo; // Remove photo field before sending

    return res.status(200).json({ message: 'User profile created or updated', user: userResponse });

  } catch (err) {
    console.error('Save profile error:', err);
    if (err.code === 11000) { // Duplicate key error (e.g., race condition if upsert fails somehow)
      // Attempt to fetch the user again in case of a rare race condition
      // Exclude photo here too
      const existingUser = await User.findOne({ email }).select('-photo');
      if (existingUser) {
        return res.status(200).json({ message: 'User already exists (race condition handled)', user: existingUser });
      }
      return res.status(409).json({ message: 'Duplicate email error during save' });
    }
    // Handle Mongoose validation errors specifically
    if (err.name === 'ValidationError') {
       // Extract meaningful messages
       const messages = Object.values(err.errors).map(e => e.message);
       console.log('Validation Errors:', messages);
       return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}` });
    }
    return res.status(500).json({ message: 'Server error while saving profile' });
  }
});

module.exports = router; // Ensure the router is exported correctly