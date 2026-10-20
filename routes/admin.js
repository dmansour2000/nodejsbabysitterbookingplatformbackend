const express = require('express');
const User = require('../models/User');
const Babysitter = require('../models/Babysitter');
const Booking = require('../models/Booking');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const privateDir = path.join(__dirname, '..', 'private_uploads');

const router = express.Router();

const adminAuth = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user.id).select('role isSuperUser');
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }
        req.currentUser = currentUser;
        next();
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};


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
router.delete('/users/:id', auth, adminAuth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid ID format' });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user._id.equals(req.currentUser._id)) {
            return res.status(400).json({ msg: 'You cannot delete your own account' });
        }
        if (user.role === 'admin' && !req.currentUser.isSuperUser) {
            return res.status(403).json({ msg: 'Only a super user can remove an admin' });
        }
        await User.findByIdAndDelete(user._id);
        const profile = await Babysitter.findOneAndDelete({ userId: user._id });
        if (profile) await Booking.deleteMany({ babysitterId: profile._id });
        await Booking.deleteMany({ parentId: user._id });
        res.json({ msg: 'User removed' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Get all babysitters
router.get('/babysitters', auth, adminAuth, async (req, res) => {
    try {
        const babysitters = await Babysitter.find().select('+nationalIdFile +passportFile +residencyFile').populate('userId', 'username');
        res.json(babysitters.map((sitter) => ({ ...sitter.toObject(), verificationDocuments: { nationalId: !!sitter.nationalIdFile, passport: !!sitter.passportFile, residency: !!sitter.residencyFile }, nationalIdFile: undefined, passportFile: undefined, residencyFile: undefined, photoFile: undefined })));
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Admin-only document retrieval. Paths and filenames are never returned to clients.
router.get('/babysitters/:id/documents/:kind', auth, adminAuth, async (req, res) => {
    const fieldByKind = { nationalId: 'nationalIdFile', passport: 'passportFile', residency: 'residencyFile' };
    const field = fieldByKind[req.params.kind];
    if (!field || !mongoose.Types.ObjectId.isValid(req.params.id)) return res.sendStatus(404);
    try {
        const sitter = await Babysitter.findById(req.params.id).select(`+${field}`);
        const filename = sitter?.[field];
        if (!filename) return res.sendStatus(404);
        res.setHeader('Cache-Control', 'private, no-store');
        res.sendFile(path.join(privateDir, filename));
    } catch (_) { res.sendStatus(404); }
});

router.patch('/babysitters/:id/moderation', auth, adminAuth, async (req, res) => {
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !['approved', 'unapproved', 'blacklisted'].includes(status)) return res.status(400).json({ msg: 'Choose a valid moderation status' });
    try {
        const sitter = await Babysitter.findById(req.params.id).select('+nationalIdFile +passportFile +residencyFile');
        if (!sitter) return res.status(404).json({ msg: 'Babysitter not found' });
        if (status === 'approved') {
            const complete = sitter.nationalityType === 'egyptian' ? !!sitter.nationalIdFile : !!(sitter.passportFile && sitter.residencyFile);
            if (!complete) return res.status(400).json({ msg: sitter.nationalityType === 'egyptian' ? 'An Egyptian national ID is required before approval' : 'A passport and residency permit or visa are required before approval' });
        }
        sitter.moderationStatus = status;
        if (status !== 'approved') sitter.available = false;
        await sitter.save();
        res.json({ msg: 'Moderation status updated', moderationStatus: sitter.moderationStatus });
    } catch (_) { res.status(500).json({ msg: 'Unable to update moderation status' }); }
});

// Remove a babysitter
router.delete('/babysitters/:id', auth, adminAuth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid ID format' });
        }
        const babysitter = await Babysitter.findById(req.params.id).select('+photoFile +nationalIdFile +passportFile +residencyFile');
        if (!babysitter) return res.status(404).json({ msg: 'Babysitter not found' });
        for (const filename of [babysitter.photoFile, babysitter.nationalIdFile, babysitter.passportFile, babysitter.residencyFile]) if (filename) fs.unlink(path.join(privateDir, filename), () => {});
        await Babysitter.findByIdAndDelete(babysitter._id);
        await User.findByIdAndDelete(babysitter.userId);
        await Booking.deleteMany({ babysitterId: babysitter._id });
        res.json({ msg: 'Babysitter removed' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;