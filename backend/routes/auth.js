// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Adjust path if necessary

// Renamed endpoint for clarity, receives POST after user confirms details
router.post('/complete-profile', async (req, res) => {
  // Expect email (from Google), name, photo, phoneNumber (from user form)
  const { email, name, photo, phoneNumber } = req.body;
  console.log("Backend received /complete-profile request:", req.body);

  // Basic validation
  if (!email || !name || !phoneNumber) { // photo might be optional
    return res.status(400).json({ message: 'Email, Name, and Phone Number are required' });
  }

  try {
    let user = await User.findOne({ email });

    if (user) {
      // User exists, update their details from the form submission
      user.name = name;
      user.photo = photo || user.photo; // Keep old photo if new one isn't provided
      user.phoneNumber = phoneNumber;
      await user.save();
      console.log("Updated existing user profile:", user);
      return res.status(200).json({ message: 'User profile updated', user });
    } else {
      // User doesn't exist, create a new one with all the details
      const newUser = new User({
        email,
        name,
        photo,
        phoneNumber
      });
      await newUser.save();
      console.log("Created new user profile:", newUser);
      return res.status(201).json({ message: 'New user profile created', user: newUser });
    }
  } catch (err) {
    console.error('Error during profile completion:', err);
    // Handle potential duplicate key error if email constraint fails unexpectedly
    if (err.code === 11000) {
        return res.status(409).json({ message: 'Email already exists (concurrent request?)' });
    }
    return res.status(500).json({ message: 'Server error during profile completion' });
  }
});

module.exports = router;