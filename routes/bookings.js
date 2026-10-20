const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Babysitter = require('../models/Babysitter');
const User = require('../models/User');

const router = express.Router();
const allowedServices = ['cleaning', 'babysitting', 'cooking', 'studying'];

function auth(req, res, next) {
    const authorization = req.header('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) return res.status(401).json({ msg: 'Authentication required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        return res.status(401).json({ msg: 'Session is invalid or expired' });
    }
}

async function currentAccount(req, res, next) {
    try {
        const account = await User.findById(req.user.id).select('role username name');
        if (!account) return res.status(401).json({ msg: 'Account not found' });
        req.account = account;
        next();
    } catch (err) {
        return res.status(500).json({ msg: 'Unable to verify account' });
    }
}

function populated(query) {
    return query
        .populate('parentId', 'username name')
        .populate({ path: 'babysitterId', select: 'name phone services userId', populate: { path: 'userId', select: 'username' } })
        .sort({ startAt: 1 });
}

router.get('/', auth, currentAccount, async (req, res) => {
    try {
        let filter;
        if (req.account.role === 'user') {
            filter = { parentId: req.account._id };
        } else if (req.account.role === 'babysitter') {
            const profile = await Babysitter.findOne({ userId: req.account._id }).select('_id');
            if (!profile) return res.json([]);
            filter = { babysitterId: profile._id };
        } else {
            return res.status(403).json({ msg: 'Bookings are not available for this account' });
        }

        const bookings = await populated(Booking.find(filter));
        res.json(bookings);
    } catch (err) {
        console.error('Unable to load bookings:', err.message);
        res.status(500).json({ msg: 'Unable to load bookings' });
    }
});

router.post('/', auth, currentAccount, async (req, res) => {
    if (req.account.role !== 'user') {
        return res.status(403).json({ msg: 'Only parent accounts can request a booking' });
    }

    const { babysitterId, service, startAt, endAt, childrenCount, notes = '' } = req.body;
    if (!mongoose.Types.ObjectId.isValid(babysitterId)) {
        return res.status(400).json({ msg: 'Choose a valid babysitter' });
    }
    if (!allowedServices.includes(service)) {
        return res.status(400).json({ msg: 'Choose a valid service' });
    }

    const starts = new Date(startAt);
    const ends = new Date(endAt);
    const count = Number(childrenCount);
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || starts <= new Date() || ends <= starts) {
        return res.status(400).json({ msg: 'Choose a future start and an end time after the start' });
    }
    if (!Number.isInteger(count) || count < 1 || count > 10) {
        return res.status(400).json({ msg: 'Children count must be between 1 and 10' });
    }
    if (typeof notes !== 'string' || notes.length > 1000) {
        return res.status(400).json({ msg: 'Notes must be 1000 characters or fewer' });
    }

    try {
        const sitter = await Babysitter.findById(babysitterId);
        if (!sitter || !sitter.available || sitter.moderationStatus !== 'approved' || sitter.hasAcceptedBooking) {
            return res.status(404).json({ msg: 'This babysitter is not currently available' });
        }
        if (!sitter.services.includes(service)) {
            return res.status(400).json({ msg: 'This babysitter does not offer that service' });
        }

        const overlap = await Booking.exists({
            babysitterId: sitter._id,
            status: { $in: ['pending', 'accepted'] },
            startAt: { $lt: ends },
            endAt: { $gt: starts }
        });
        if (overlap) {
            return res.status(409).json({ msg: 'This time overlaps another active booking request' });
        }

        const booking = await Booking.create({
            parentId: req.account._id,
            babysitterId: sitter._id,
            service,
            startAt: starts,
            endAt: ends,
            childrenCount: count,
            notes: notes.trim()
        });
        const result = await populated(Booking.findById(booking._id));
        res.status(201).json(result);
    } catch (err) {
        console.error('Unable to create booking:', err.message);
        res.status(500).json({ msg: 'Unable to create booking' });
    }
});

router.patch('/:id/status', auth, currentAccount, async (req, res) => {
    const { status } = req.body;
    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
        return res.status(400).json({ msg: 'Unsupported booking status' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ msg: 'Invalid booking ID' });
    }

    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ msg: 'Booking not found' });

        if (req.account.role === 'user') {
            if (!booking.parentId.equals(req.account._id) || status !== 'cancelled') {
                return res.status(403).json({ msg: 'You cannot change this booking' });
            }
            if (!['pending', 'accepted'].includes(booking.status)) {
                return res.status(409).json({ msg: 'This booking can no longer be cancelled' });
            }
        } else if (req.account.role === 'babysitter') {
            const profile = await Babysitter.findOne({ userId: req.account._id }).select('_id');
            if (!profile || !booking.babysitterId.equals(profile._id) || !['accepted', 'declined'].includes(status)) {
                return res.status(403).json({ msg: 'You cannot change this booking' });
            }
            if (booking.status !== 'pending') {
                return res.status(409).json({ msg: 'Only pending requests can be accepted or declined' });
            }
            if (status === 'accepted') {
                const overlap = await Booking.exists({
                    _id: { $ne: booking._id },
                    babysitterId: profile._id,
                    status: 'accepted',
                    startAt: { $lt: booking.endAt },
                    endAt: { $gt: booking.startAt }
                });
                if (overlap) return res.status(409).json({ msg: 'This time conflicts with an accepted booking' });
            }
        } else {
            return res.status(403).json({ msg: 'You cannot change this booking' });
        }

        booking.status = status;
        await booking.save();
        if (status === 'accepted') await Babysitter.updateOne({ _id: booking.babysitterId }, { $set: { hasAcceptedBooking: true, available: false } });
        const result = await populated(Booking.findById(booking._id));
        res.json(result);
    } catch (err) {
        console.error('Unable to update booking:', err.message);
        res.status(500).json({ msg: 'Unable to update booking' });
    }
});

module.exports = router;
