const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    caregiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Babysitter',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    userName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
    },
}, { timestamps: true });

// Prevent multiple reviews from the same user on the same caregiver (can update existing)
ReviewSchema.index({ caregiverId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);

