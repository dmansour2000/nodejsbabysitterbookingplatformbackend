const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true },
    password: { type: String, required: false },
    email: { type: String, trim: true, lowercase: true },
    googleId: { type: String, trim: true, unique: true, sparse: true },
    role: { type: String, enum: ['user', 'babysitter', 'admin'], default: 'user' },
    isSuperUser: { type: Boolean, default: false },
    fcmTokens: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);