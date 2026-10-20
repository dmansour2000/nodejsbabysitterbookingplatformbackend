const mongoose = require('mongoose');

const BabysitterSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    age: { type: Number, min: 18, max: 100 },
    nationality: { type: String, trim: true },
    nationalityType: { type: String, enum: ['egyptian', 'other'], default: 'egyptian' },
    city: { type: String, trim: true, maxlength: 100 },
    bio: { type: String, trim: true, maxlength: 1500 },
    monthlySalary: { type: Number, min: 0, max: 10000000 },
    currency: { type: String, enum: ['EGP', 'USD'], default: 'EGP' },
    services: { type: [String], enum: ['cleaning', 'babysitting', 'cooking', 'studying'], default: [] },
    available: { type: Boolean, default: true },
    moderationStatus: { type: String, enum: ['pending', 'approved', 'unapproved', 'blacklisted'], default: 'pending', index: true },
    hasAcceptedBooking: { type: Boolean, default: false, index: true },
    photoFile: { type: String, select: false },
    nationalIdFile: { type: String, select: false },
    passportFile: { type: String, select: false },
    residencyFile: { type: String, select: false },
}, { timestamps: true });

module.exports = mongoose.model('Babysitter', BabysitterSchema);
