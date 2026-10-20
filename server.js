require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.use('/api/user', require('./routes/user'));
app.use('/api/babysitter', require('./routes/babysitter'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/blacklist', require('./routes/blacklist'));

const PORT = process.env.PORT || 5170;

async function startServer() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required');
    }
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch((err) => {
    console.error('Server failed to start:', err.message);
    process.exit(1);
});
