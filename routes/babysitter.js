const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Babysitter = require('../models/Babysitter');
const mongoose = require('mongoose');

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


// Update babysitter profile
router.put('/profile', auth, async (req, res) => {
    const { phone, age, nationality, services } = req.body;

    try {
        // Find the babysitter profile by user ID
        const babysitter = await Babysitter.findOne({ userId: req.user.id });

        if (!babysitter) {
            return res.status(404).json({ msg: 'Babysitter profile not found' });
        }

        // Update the profile fields
        if (phone) babysitter.phone = phone;
        if (age) babysitter.age = age;
        if (nationality) babysitter.nationality = nationality;
        if (services) babysitter.services = services;

        // Save the updated profile
        await babysitter.save();

        res.json({ msg: 'Profile updated successfully', babysitter });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


// Get all available babysitters
router.get('/', async (req, res) => {
    try {
        const babysitters = await Babysitter.find({ available: true });
        res.json(babysitters);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Get a babysitter
router.get('/users/:id', auth, async (req, res) => {
    try {
        const user = await Babysitter.findOne({ userId: req.params.id });
        res.json(user);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Register a new babysitter
router.post('/register', async (req, res) => {
    const { username, password, name, phone, age, nationality, services } = req.body;

    try {
        // Check if the user already exists
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Create a new user with the role of 'babysitter'
        user = new User({
            username,
            password,
            role: 'babysitter'
        });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save the user
        await user.save();

        // Create a new babysitter profile
        const babysitter = new Babysitter({
            userId: user.id,
            name,
            phone,
            age,
            nationality,
            services
        });

        // Save the babysitter profile
        await babysitter.save();

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



// Accept work request
router.put('/accept/:id', auth, async (req, res) => {
    try {
        const babysitter = await Babysitter.findById(req.params.id);
        if (!babysitter) return res.status(404).json({ msg: 'Babysitter not found' });

        if (babysitter.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        babysitter.available = false;
        await babysitter.save();
        res.json(babysitter);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// In routes/babysitters.js
router.put('/profile', auth, async (req, res) => {
    const { phone, age, nationality, services } = req.body;

    try {
        const babysitter = await Babysitter.findOne({ userId: req.user.id });
        if (!babysitter) {
            return res.status(404).json({ msg: 'Babysitter not found' });
        }

        babysitter.phone = phone;
        babysitter.age = age;
        babysitter.nationality = nationality;
        babysitter.services = services;

        await babysitter.save();
        res.json({ msg: 'Profile updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;