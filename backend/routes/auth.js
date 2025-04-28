// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Fixed case-sensitive import

// NEW: Endpoint to handle initial Google Sign-In check
router.post('/google-login', async (req, res) => {
  const { email, name, picture } = req.body;
  console.log("Received /google-login with:", { email, name, picture });

  if (!email) {
    console.log("Missing email for Google login check.");
    return res.status(400).json({ message: 'Email is required for Google Sign-In check' });
  }

  try {
    let user = await User.findOne({ email });
    console.log("User found during Google login check?", user);

    if (user) {
      // User exists, return their data
      console.log("User already exists, returning profile.");
      // Optionally update photo if Google's is newer/different? For now, just return existing.
      // user.photo = picture || user.photo; // Example: Optional update
      // await user.save(); // Only if you update
      return res.status(200).json({ needsCompletion: false, user });
    } else {
      // User does not exist, signal frontend to ask for completion
      console.log("User does not exist, needs profile completion.");
      return res.status(200).json({ // Use 200 OK, but signal action needed
        needsCompletion: true,
        email: email,
        suggestedName: name || '',   // Send suggestions for the form
        suggestedPhoto: picture || ''
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
  console.log("Received /complete-profile with:", req.body);

  // Validation remains important
  if (!email || !name || !phoneNumber) {
    console.log("Missing required fields for profile completion.");
    return res.status(400).json({ message: 'Email, Name, and Phone Number are required' });
  }

  try {
    // We expect this usually to be a new user creation in the Google Sign-In flow
    // But findOneAndUpdate with upsert: true handles both creation and potential race conditions/updates gracefully.
    const updatedOrNewUser = await User.findOneAndUpdate(
      { email: email }, // Find user by email
      {
        $set: { // Set these fields
          name: name,
          photo: photo, // Use provided photo, may be empty string
          phoneNumber: phoneNumber
        },
        $setOnInsert: { email: email } // Set email only if creating (inserting)
      },
      {
        new: true, // Return the modified document (or new one)
        upsert: true, // Create if document doesn't exist
        runValidators: true // Ensure schema validation runs on update/insert
      }
    );

    console.log("Saved/Updated user via complete-profile:", updatedOrNewUser);
    // Use 201 for creation, 200 for update - checking if it was an upsert is complex,
    // so let's consistently return 200 OK upon success here for simplicity after upsert.
    return res.status(200).json({ message: 'User profile created or updated', user: updatedOrNewUser });

  } catch (err) {
    console.error('Save profile error:', err);
    if (err.code === 11000) { // Duplicate key error (e.g., race condition if upsert fails somehow)
      // Attempt to fetch the user again in case of a rare race condition
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(200).json({ message: 'User already exists (race condition handled)', user: existingUser });
      }
      return res.status(409).json({ message: 'Duplicate email error during save' });
    }
    // Handle validation errors specifically
    if (err.name === 'ValidationError') {
       return res.status(400).json({ message: 'Validation error', errors: err.errors });
    }
    return res.status(500).json({ message: 'Server error while saving profile' });
  }
});

module.exports = router; // Ensure the router is exported correctly