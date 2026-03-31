const mongoose = require('mongoose');

const BabysitterSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    phone: { 
        type: String, 
        required: false
    },
    age: { 
        type: Number, 
        required: false
    },
    nationality: { 
        type: String, 
        required: false
    },
    services: {
        type: [String], 
        enum: ['cleaning', 'babysitting', 'cooking', 'studying'], // restricting to specific options
        default: []
    },
    available: { 
        type: Boolean, 
        default: true 
    }
    // Add more fields as necessary, e.g., bio, experience, etc.
});

module.exports = mongoose.model('Babysitter', BabysitterSchema);