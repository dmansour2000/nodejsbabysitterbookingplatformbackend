const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    babysitterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Babysitter',
        required: true
    },
    service: {
        type: String,
        enum: ['cleaning', 'babysitting', 'cooking', 'studying', 'elderlyCare'],
        required: true
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    childrenCount: { type: Number, min: 1, max: 10, required: true },
    notes: { type: String, maxlength: 1000, default: '' },
    caregiverNotes: { type: String, maxlength: 1000, default: '' },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'cancelled'],
        default: 'pending',
        index: true
    }
}, { timestamps: true });

BookingSchema.index({ babysitterId: 1, startAt: 1, endAt: 1, status: 1 });

module.exports = mongoose.model('Booking', BookingSchema);
