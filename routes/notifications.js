const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

function auth(req, res, next) {
    const authorization = req.header('Authorization');
    const token = (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null) || req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'Authentication required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        return res.status(401).json({ msg: 'Session is invalid or expired' });
    }
}

// Get user notifications + unread count
router.get('/', auth, async (req, res) => {
    try {
        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ recipientId: req.user.id })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
            Notification.countDocuments({ recipientId: req.user.id, read: false }),
        ]);

        res.json({
            notifications,
            unreadCount,
        });
    } catch (err) {
        console.error('Failed to load notifications:', err.message);
        res.status(500).json({ msg: 'Failed to load notifications' });
    }
});

// Mark single notification as read
router.patch('/:id/read', auth, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ msg: 'Invalid notification ID' });
    }

    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipientId: req.user.id },
            { $set: { read: true } },
            { new: true }
        );
        if (!notification) return res.status(404).json({ msg: 'Notification not found' });
        res.json(notification);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// Mark all user notifications as read
router.patch('/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientId: req.user.id, read: false },
            { $set: { read: true } }
        );
        res.json({ msg: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// Register FCM device token for push notifications
router.post('/register-token', auth, async (req, res) => {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ msg: 'Valid FCM token required' });
    }

    try {
        await User.updateOne(
            { _id: req.user.id },
            { $addToSet: { fcmTokens: token.trim() } }
        );
        res.json({ msg: 'FCM push token registered successfully' });
    } catch (err) {
        console.error('Failed to register FCM token:', err.message);
        res.status(500).json({ msg: 'Failed to register token' });
    }
});

module.exports = router;
