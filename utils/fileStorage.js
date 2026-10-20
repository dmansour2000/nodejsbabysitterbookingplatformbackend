const fs = require('fs');
const path = require('path');
const StoredFile = require('../models/StoredFile');

const privateDir = path.join(__dirname, '..', 'private_uploads');
try {
    fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
} catch (_) {}

function getMimeType(filename) {
    const ext = path.extname(filename || '').toLowerCase();
    const map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
    };
    return map[ext] || 'application/octet-stream';
}

async function saveFileToDatabase(filename, filePath, mimetype) {
    if (!filename) return;
    try {
        const baseName = path.basename(filename);
        const fullPath = filePath || path.join(privateDir, baseName);
        if (fs.existsSync(fullPath)) {
            const data = fs.readFileSync(fullPath);
            const contentType = mimetype || getMimeType(baseName);
            await StoredFile.findOneAndUpdate(
                { filename: baseName },
                {
                    filename: baseName,
                    contentType,
                    data,
                    size: data.length,
                },
                { upsert: true, new: true }
            );
        }
    } catch (err) {
        console.error(`Error saving file ${filename} to database:`, err.message);
    }
}

async function serveFile(filename, res, options = {}) {
    if (!filename) return res.sendStatus(404);
    const baseName = path.basename(filename);

    res.setHeader('Cache-Control', options.cacheControl || 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
        const stored = await StoredFile.findOne({ filename: baseName });
        if (stored?.data) {
            res.setHeader('Content-Type', stored.contentType || getMimeType(baseName));
            return res.send(stored.data);
        }
    } catch (err) {
        console.error('Error fetching file from DB:', err.message);
    }

    const filePath = path.join(privateDir, baseName);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', getMimeType(baseName));
        return res.sendFile(filePath, (err) => {
            if (err && !res.headersSent) res.sendStatus(404);
        });
    }

    return res.sendStatus(404);
}

async function deleteStoredFile(filename) {
    if (!filename) return;
    const baseName = path.basename(filename);
    try {
        await StoredFile.deleteOne({ filename: baseName });
    } catch (err) {
        console.error('Error deleting file from DB:', err.message);
    }
    const filePath = path.join(privateDir, baseName);
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
    }
}

async function syncLocalFilesToDb() {
    try {
        if (!fs.existsSync(privateDir)) return;
        const files = fs.readdirSync(privateDir);
        for (const file of files) {
            if (file.startsWith('.')) continue;
            const fullPath = path.join(privateDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                const count = await StoredFile.countDocuments({ filename: file });
                if (count === 0) {
                    await saveFileToDatabase(file, fullPath);
                    console.log(`Synced existing file to MongoDB: ${file}`);
                }
            }
        }
    } catch (err) {
        console.error('File sync to DB error:', err.message);
    }
}

module.exports = {
    privateDir,
    getMimeType,
    saveFileToDatabase,
    serveFile,
    deleteStoredFile,
    syncLocalFilesToDb,
};

