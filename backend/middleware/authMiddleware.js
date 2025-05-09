// backend/middleware/authMiddleware.js
const mongoose = require('mongoose');
const User = require('../models/User');

const isAdmin = async (req, res, next) => {
    // Prioritize the header for all request types for consistency
    const adminUserId = req.headers['x-admin-user-id'];
    
    console.log(`isAdmin Middleware: Method=${req.method}, Path=${req.originalUrl}, AdminUserID from headers='${adminUserId}'`);

    if (!adminUserId) {
        console.log("isAdmin Middleware: Admin User ID not provided in x-admin-user-id header.");
        return res.status(401).json({ message: 'Admin User ID not provided for authorization.' });
    }

    if (!mongoose.Types.ObjectId.isValid(adminUserId)) {
        console.log(`isAdmin Middleware: Invalid Admin User ID format in header: ${adminUserId}`);
        return res.status(400).json({ message: 'Invalid Admin User ID format.' });
    }

    try {
        const adminUser = await User.findById(adminUserId).select('role').lean();

        if (!adminUser) {
            console.log(`isAdmin Middleware: Admin user not found for ID: ${adminUserId}`);
            return res.status(404).json({ message: 'Admin user not found for authorization.' });
        }

        if (adminUser.role !== 'admin') {
            console.log(`isAdmin Middleware: User ${adminUserId} is not an admin. Role: ${adminUser.role}`);
            return res.status(403).json({ message: 'Forbidden: User does not have admin privileges.' });
        }

        console.log(`isAdmin Middleware: User ${adminUserId} authorized as admin.`);
        req.adminUser = { _id: adminUser._id, role: adminUser.role }; // Attach admin user _id and role
        next();
    } catch (error) {
        console.error("isAdmin Middleware: Admin authorization error:", error);
        res.status(500).json({ message: 'Server error during admin authorization.' });
    }
};

// Define isAuthenticated even if it's just a placeholder
const isAuthenticated = (req, res, next) => {
    console.warn("isAuthenticated middleware is a placeholder. Ensure routes are secured appropriately if user tokens are implemented.");
    next();
};

module.exports = { isAdmin, isAuthenticated };