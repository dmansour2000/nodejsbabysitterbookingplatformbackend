const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Babysitter = require('../models/Babysitter');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const privateDir = path.join(__dirname, '..', 'private_uploads');

const router = express.Router();

function auth(req, res, next) {
    const authorization = req.header('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

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
        const requester = await User.findById(req.user.id).select('role isSuperUser');
        if (!requester || requester.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }

        const userId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ msg: 'Invalid user ID format' });
        }
        if (userId === requester.id) {
            return res.status(400).json({ msg: 'You cannot delete your own account' });
        }
        
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        if (user.role === 'admin' && !requester.isSuperUser) {
            return res.status(403).json({ msg: 'Only a super user can remove an admin' });
        }

        await User.findByIdAndDelete(userId);
        const profile = await Babysitter.findOne({ userId: user._id }).select('+photoFile +nationalIdFile +passportFile +residencyFile');
        if (profile) {
            for (const filename of [profile.photoFile, profile.nationalIdFile, profile.passportFile, profile.residencyFile]) if (filename) fs.unlink(path.join(privateDir, filename), () => {});
            await Babysitter.deleteOne({ _id: profile._id });
            await Booking.deleteMany({ babysitterId: profile._id });
        }
        await Booking.deleteMany({ parentId: user._id });
        res.json({ msg: 'User removed' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get a user
router.get('/users/:id', auth, async (req, res) => {
    try {
        const requester = await User.findById(req.user.id).select('role');
        if (!requester || requester.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format' });
        }
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).send('Server error');
    }
});


// Registration route
router.post('/register', async (req, res) => {
    const { username, password, name } = req.body;

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ msg: 'Username and a password of at least 8 characters are required' });
    }

    try {
        // Check if the user already exists
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Create a new user
        user = new User({
            username: username.trim(),
            password,
            name: typeof name === 'string' ? name.trim() : '',
            role: 'user'
        });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save the user
        await user.save();

        // Generate a JWT token
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


// Login user
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

        const payload = {
            user: {
                id: user.id,
                role: user.role, // Ensure role is included
                isSuperUser: user.isSuperUser
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: payload.user }); // Send user info in response
            }
        );
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Get user data
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;