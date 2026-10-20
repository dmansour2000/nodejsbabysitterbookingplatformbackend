const mongoose = require('mongoose');

const BlacklistedCaregiverSchema = new mongoose.Schema({
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nationality: { type: String, required: true, trim: true, maxlength: 80 },
    age: { type: Number, min: 18, max: 100 },
    reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    photoFile: { type: String, required: true, select: false },
    verificationDocuments: [{ type: String, select: false }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('BlacklistedCaregiver', BlacklistedCaregiverSchema);
