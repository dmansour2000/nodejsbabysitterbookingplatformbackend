const mongoose = require('mongoose');

const StoredFileSchema = new mongoose.Schema({
    filename: { type: String, required: true, unique: true, index: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('StoredFile', StoredFileSchema);

