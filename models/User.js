const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'babysitter', 'admin'], default: 'user' },
    isSuperUser: { type: Boolean, default: false } 
});

module.exports = mongoose.model('User', UserSchema);