require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Root API documentation endpoints
const path = require('path');
const { getApiCatalog } = require('./docs/apiCatalog');
const { renderHtmlDocs } = require('./docs/htmlRenderer');

const docsHandler = (req, res) => {
    const catalog = getApiCatalog();
    const wantsJson = req.query.format === 'json' || req.path.endsWith('.json') || (req.accepts('json') && !req.accepts('html'));

    if (wantsJson) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.json(catalog);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderHtmlDocs(catalog));
};

const iconPath = path.join(__dirname, 'docs', 'carenest-icon.png');
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(iconPath);
});
app.get('/', docsHandler);
app.get('/docs', docsHandler);
app.get('/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json(getApiCatalog());
});
app.get('/api', docsHandler);

app.use('/api/user', require('./routes/user'));
app.use('/api/babysitter', require('./routes/babysitter'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/blacklist', require('./routes/blacklist'));
app.use('/api/notifications', require('./routes/notifications'));

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
    const { syncLocalFilesToDb } = require('./utils/fileStorage');
    syncLocalFilesToDb().catch((err) => console.error('Initial file sync error:', err.message));
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch((err) => {
    console.error('Server failed to start:', err.message);
    process.exit(1);
});
