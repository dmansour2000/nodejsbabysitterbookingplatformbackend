const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Babysitter = require('../models/Babysitter');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

const router = express.Router();
const allowedServices = ['cleaning', 'babysitting', 'cooking', 'elderlyCare'];

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
        .populate({ path: 'babysitterId', select: 'name phone services userId photoFile', populate: { path: 'userId', select: 'username' } })
        .sort({ startAt: 1 });
}

function parseDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

async function syncAcceptedBookingAvailability(sitterId) {
    const hasActiveAcceptedBooking = await Booking.exists({
        babysitterId: sitterId,
        status: 'accepted',
        endAt: { $gt: new Date() }
    });
    await Babysitter.updateOne({ _id: sitterId }, {
        $set: {
            hasAcceptedBooking: Boolean(hasActiveAcceptedBooking),
            available: !hasActiveAcceptedBooking
        }
    });
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
        const formatted = bookings.map((b) => {
            const item = b.toObject();
            if (item.babysitterId && typeof item.babysitterId === 'object') {
                item.babysitterId.photoUrl = item.babysitterId.photoFile ? `/api/babysitter/photo/${item.babysitterId._id}` : null;
                delete item.babysitterId.photoFile;
            }
            return item;
        });
        res.json(formatted);
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

    const starts = parseDateOnly(startAt);
    const selectedEndDate = parseDateOnly(endAt);
    const ends = selectedEndDate
        ? new Date(selectedEndDate.getTime() + 24 * 60 * 60 * 1000 - 1)
        : null;
    const count = Number(childrenCount);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!starts || !ends || starts <= today || ends < starts) {
        return res.status(400).json({ msg: 'Choose a future start date and an end date on or after it' });
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

        // Notify the caregiver about new booking request
        if (sitter.userId) {
            sendNotification({
                recipientId: sitter.userId,
                type: 'booking_requested',
                title: 'New Booking Request 📅',
                message: `You received a new ${service} booking request from ${req.account.name || req.account.username}.`,
                data: {
                    bookingId: String(booking._id),
                    service,
                }
            }).catch((e) => console.warn('Booking notification error:', e.message));
        }

        const result = await populated(Booking.findById(booking._id));
        res.status(201).json(result);
    } catch (err) {
        console.error('Unable to create booking:', err.message);
        res.status(500).json({ msg: 'Unable to create booking' });
    }
});

router.patch('/:id/status', auth, currentAccount, async (req, res) => {
    const { status } = req.body;
    if (!['accepted', 'declined', 'cancelled', 'pending'].includes(status)) {
        return res.status(400).json({ msg: 'Unsupported booking status' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ msg: 'Invalid booking ID' });
    }

    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ msg: 'Booking not found' });

        if (req.account.role === 'user') {
            if (!booking.parentId.equals(req.account._id)) {
                return res.status(403).json({ msg: 'You cannot change this booking' });
            }
            if (status === 'cancelled') {
                if (!['pending', 'accepted'].includes(booking.status)) {
                    return res.status(409).json({ msg: 'This booking can no longer be cancelled' });
                }
            } else if (status === 'pending') {
                if (booking.status !== 'cancelled') {
                    return res.status(409).json({ msg: 'Only cancelled requests can be reactivated' });
                }
                if (booking.startAt <= new Date()) {
                    return res.status(409).json({ msg: 'The booking time has already started' });
                }
                const sitter = await Babysitter.findById(booking.babysitterId).select('available moderationStatus hasAcceptedBooking');
                if (!sitter || !sitter.available || sitter.moderationStatus !== 'approved' || sitter.hasAcceptedBooking) {
                    return res.status(409).json({ msg: 'The caregiver is not currently available' });
                }
                const conflict = await Booking.exists({
                    _id: { $ne: booking._id },
                    babysitterId: booking.babysitterId,
                    status: { $in: ['pending', 'accepted'] },
                    startAt: { $lt: booking.endAt },
                    endAt: { $gt: booking.startAt }
                });
                if (conflict) return res.status(409).json({ msg: 'This request conflicts with another active booking' });
            } else {
                return res.status(403).json({ msg: 'You cannot change this booking' });
            }
        } else if (req.account.role === 'babysitter') {
            const profile = await Babysitter.findOne({ userId: req.account._id }).select('_id');
            if (!profile || !booking.babysitterId.equals(profile._id)) {
                return res.status(403).json({ msg: 'You cannot change this booking' });
            }

            if (status === 'pending') {
                if (booking.status !== 'accepted') {
                    return res.status(409).json({ msg: 'Only accepted requests can have their approval withdrawn' });
                }
            } else {
                if (!['accepted', 'declined'].includes(status)) {
                    return res.status(403).json({ msg: 'You cannot change this booking' });
                }
                if (booking.status !== 'pending') {
                    return res.status(409).json({ msg: 'Only pending requests can be accepted or declined' });
                }
            }
            if (status === 'accepted') {
                const overlap = await Booking.exists({
                    _id: { $ne: booking._id },
                    babysitterId: profile._id,
                    status: 'accepted',
                    endAt: { $gt: new Date() }
                });
                if (overlap) return res.status(409).json({ msg: 'Another booking is already approved' });
            }
        } else {
            return res.status(403).json({ msg: 'You cannot change this booking' });
        }

        const previousStatus = booking.status;
        if (status === 'accepted') {
            const caregiverNotes = req.body.caregiverNotes ?? '';
            if (typeof caregiverNotes !== 'string' || caregiverNotes.length > 1000) {
                return res.status(400).json({ msg: 'Caregiver note must be 1000 characters or fewer' });
            }
            booking.caregiverNotes = caregiverNotes.trim();
        } else if (previousStatus === 'accepted' && status === 'pending') {
            booking.caregiverNotes = '';
        }
        booking.status = status;
        await booking.save();
        if (status === 'accepted' || previousStatus === 'accepted') {
            await syncAcceptedBookingAvailability(booking.babysitterId);
        }

        // Notify parties on status update
        try {
            if (status === 'accepted') {
                const sitterProfile = await Babysitter.findById(booking.babysitterId).select('name');
                sendNotification({
                    recipientId: booking.parentId,
                    type: 'booking_accepted',
                    title: 'Booking Accepted! 🎉',
                    message: `${sitterProfile?.name || 'Your caregiver'} accepted your booking request.`,
                    data: {
                        bookingId: String(booking._id),
                        status: 'accepted',
                    }
                }).catch((e) => console.warn('Status notification error:', e.message));
            } else if (status === 'cancelled') {
                if (req.account.role === 'user') {
                    const sitterProfile = await Babysitter.findById(booking.babysitterId).select('userId');
                    if (sitterProfile?.userId) {
                        sendNotification({
                            recipientId: sitterProfile.userId,
                            type: 'booking_cancelled',
                            title: 'Booking Cancelled ⚠️',
                            message: `Booking request from ${req.account.name || req.account.username} was cancelled.`,
                            data: {
                                bookingId: String(booking._id),
                                status: 'cancelled',
                            }
                        }).catch((e) => console.warn('Status notification error:', e.message));
                    }
                } else if (req.account.role === 'babysitter') {
                    const sitterProfile = typeof Babysitter?.findById === 'function' ? await Babysitter.findById(booking.babysitterId).select('name') : null;
                    sendNotification({
                        recipientId: booking.parentId,
                        type: 'booking_cancelled',
                        title: 'Booking Cancelled ⚠️',
                        message: `${sitterProfile?.name || 'The caregiver'} cancelled the booking request.`,
                        data: {
                            bookingId: String(booking._id),
                            status: 'cancelled',
                        }
                    }).catch((e) => console.warn('Status notification error:', e.message));
                }
            } else if (status === 'declined') {
                const sitterProfile = typeof Babysitter?.findById === 'function' ? await Babysitter.findById(booking.babysitterId).select('name') : null;
                sendNotification({
                    recipientId: booking.parentId,
                    type: 'booking_declined',
                    title: 'Booking Request Declined',
                    message: `${sitterProfile?.name || 'The caregiver'} declined the booking request.`,
                    data: {
                        bookingId: String(booking._id),
                        status: 'declined',
                    }
                }).catch((e) => console.warn('Status notification error:', e.message));
            }
        } catch (notifErr) {
            console.warn('Status notification dispatch error:', notifErr.message);
        }

        const result = await populated(Booking.findById(booking._id));
        res.json(result);
    } catch (err) {
        console.error('Unable to update booking:', err.message);
        res.status(500).json({ msg: 'Unable to update booking' });
    }
});

router.delete('/:id', auth, currentAccount, async (req, res) => {
    if (req.account.role !== 'user') {
        return res.status(403).json({ msg: 'Only the family that created a request can delete it' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ msg: 'Invalid booking ID' });
    }

    try {
        const booking = await Booking.findOneAndDelete({
            _id: req.params.id,
            parentId: req.account._id
        });
        if (!booking) return res.status(404).json({ msg: 'Booking request not found' });
        if (booking.status === 'accepted') {
            await syncAcceptedBookingAvailability(booking.babysitterId);
        }
        res.json({ msg: 'Booking request deleted' });
    } catch (err) {
        console.error('Unable to delete booking:', err.message);
        res.status(500).json({ msg: 'Unable to delete booking request' });
    }
});

module.exports = router;
