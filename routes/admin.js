const express = require('express');
const User = require('../models/User');
const Babysitter = require('../models/Babysitter');

const router = express.Router();



function auth(req, res, next) {
    const token = req.header('Authorization').replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
}


// Get all users for admin panel
// Route to get users
router.get('/users', auth, async (req, res) => {
    try {
        // Fetch the current user information from database using the user ID
        const currentUser = await User.findById(req.user.id);

        if (!currentUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if the user has admin privileges
        if (currentUser.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }

        let users;
        
        if (currentUser.isSuperUser) {
            // Super user can see all users including admins but excluding themselves
            users = await User.find({ _id: { $ne: currentUser.id } }).select('-password');
        } else {
            // Regular admin can see all users except other admins
            users = await User.find({ role: { $ne: 'admin' } }).select('-password');
        }

        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});



// Remove a user
router.delete('/users/:id', auth, async (req, res) => {
    try {
        await User.findByIdAndRemove(req.params.id);
        res.json({ msg: 'User removed' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Middleware to check admin role
const adminAuth = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied' });
    }
    next();
};

// Get all babysitters
router.get('/babysitters', auth, adminAuth, async (req, res) => {
    try {
        const babysitters = await Babysitter.find();
        res.json(babysitters);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Remove a babysitter
router.delete('/babysitters/:id', auth, adminAuth, async (req, res) => {
    try {
        await Babysitter.findByIdAndRemove(req.params.id);
        res.json({ msg: 'Babysitter removed' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;