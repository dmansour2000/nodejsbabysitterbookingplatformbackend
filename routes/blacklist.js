const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const BlacklistedCaregiver = require('../models/BlacklistedCaregiver');
const { saveFileToDatabase, serveFile, deleteStoredFile, privateDir } = require('../utils/fileStorage');

const router = express.Router();
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({
    storage: multer.diskStorage({
        destination: privateDir,
        filename: (_req, file, callback) => {
            const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }[file.mimetype] || '';
            callback(null, `${crypto.randomBytes(24).toString('hex')}${extension}`);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 4 },
    fileFilter: (_req, file, callback) => {
        const valid = file.fieldname === 'photo'
            ? /^image\/(jpeg|png|webp)$/.test(file.mimetype)
            : file.fieldname === 'documents' && allowedTypes.has(file.mimetype);
        callback(valid ? null : new Error('Only JPG, PNG, WebP photos and JPG, PNG, WebP, or PDF documents are accepted'), valid);
    },
});

function auth(req, res, next) {
    const value = req.header('Authorization');
    const token = value?.startsWith('Bearer ') ? value.slice(7) : null;
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET).user;
        if (!req.user?.id || !req.user?.role) return res.status(401).json({ msg: 'Token is not valid' });
        next();
    } catch (_) { return res.status(401).json({ msg: 'Token is not valid' }); }
}

function regularUser(req, res, next) {
    if (req.user.role !== 'user') return res.status(403).json({ msg: 'Regular user account required' });
    next();
}

async function admin(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ msg: 'Admin access required' });
    try {
        const query = User.findById(req.user.id);
        const account = typeof query?.select === 'function' ? await query.select('role') : await query;
        if (!account || account.role !== 'admin') return res.status(403).json({ msg: 'Admin access required' });
        next();
    } catch (_) { return res.status(500).json({ msg: 'Server error' }); }
}

function handleUpload(req, res, next) {
    upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'documents', maxCount: 3 }])(req, res, (error) => {
        if (error) return res.status(400).json({ msg: error.message || 'Invalid upload' });
        next();
    });
}

function removeFiles(files = []) {
    for (const file of files) if (file?.filename) fs.unlink(path.join(privateDir, path.basename(file.filename)), () => {});
}

function publicEntry(entry) {
    const value = typeof entry.toObject === 'function' ? entry.toObject() : { ...entry };
    delete value.photoFile;
    delete value.verificationDocuments;
    delete value.submittedBy;
    delete value.reviewedBy;
    value.photoUrl = `/api/blacklist/${value._id}/photo`;
    return value;
}

router.get('/', async (_req, res) => {
    try {
        const entries = await BlacklistedCaregiver.find({ status: 'approved' })
            .select('name nationality age reason status createdAt +photoFile')
            .sort({ createdAt: -1 }).lean();
        return res.json(entries.map((entry) => ({
            _id: entry._id,
            name: entry.name,
            nationality: entry.nationality,
            ...(entry.age !== undefined ? { age: entry.age } : {}),
            reason: entry.reason,
            status: 'approved',
            createdAt: entry.createdAt,
            photoUrl: entry.photoFile ? `/api/blacklist/${entry._id}/photo` : null,
        })));
    } catch (error) {
        console.error('Could not load approved caregiver reports:', error.message);
        return res.status(500).json({ msg: 'Could not load caregiver reports' });
    }
});

router.get('/mine', auth, regularUser, async (req, res) => {
    try {
        const entries = await BlacklistedCaregiver.find({ submittedBy: req.user.id })
            .select('name status createdAt').sort({ createdAt: -1 }).lean();
        return res.json(entries);
    } catch (_) { return res.status(500).json({ msg: 'Could not load submitted reports' }); }
});

router.post('/', auth, regularUser, handleUpload, async (req, res) => {
    const files = [...(req.files?.photo || []), ...(req.files?.documents || [])];
    const { name, nationality, age, reason } = req.body || {};
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedNationality = typeof nationality === 'string' ? nationality.trim() : '';
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const numericAge = age === undefined || age === '' ? undefined : Number(age);

    if (!normalizedName || normalizedName.length > 100 || !normalizedNationality || normalizedNationality.length > 80 || normalizedReason.length < 10 || normalizedReason.length > 2000 || (numericAge !== undefined && (!Number.isInteger(numericAge) || numericAge < 18 || numericAge > 100))) {
        removeFiles(files);
        return res.status(400).json({ msg: 'Enter a name, nationality, a reason of 10 to 2000 characters, and a valid optional age' });
    }
    try {
        const photoFile = req.files?.photo?.[0] || null;
        const docFiles = req.files?.documents || [];
        if (typeof saveFileToDatabase === 'function') {
            if (photoFile?.path) {
                await saveFileToDatabase(photoFile.filename, photoFile.path, photoFile.mimetype);
            }
            for (const doc of docFiles) {
                if (doc?.path) await saveFileToDatabase(doc.filename, doc.path, doc.mimetype);
            }
        }

        const entry = await BlacklistedCaregiver.create({
            submittedBy: req.user.id,
            name: normalizedName,
            nationality: normalizedNationality,
            ...(numericAge !== undefined ? { age: numericAge } : {}),
            reason: normalizedReason,
            ...(photoFile ? { photoFile: photoFile.filename } : {}),
            verificationDocuments: docFiles.map((file) => file.filename),
            status: 'pending',
        });
        return res.status(201).json({ id: entry._id, status: entry.status, msg: 'Report sent for admin review' });
    } catch (error) {
        removeFiles(files);
        console.error('Could not save caregiver report:', error.message);
        return res.status(500).json({ msg: 'Could not submit caregiver report' });
    }
});

router.get('/admin/review', auth, admin, async (_req, res) => {
    try {
        const entries = await BlacklistedCaregiver.find({ status: 'pending' })
            .select('+photoFile +verificationDocuments')
            .sort({ createdAt: 1 }).lean();
        return res.json(entries.map((entry) => {
            const result = { ...entry, documentCount: entry.verificationDocuments?.length || 0 };
            delete result.photoFile;
            delete result.verificationDocuments;
            return result;
        }));
    } catch (_) { return res.status(500).json({ msg: 'Could not load reports for review' }); }
});

router.delete('/admin/:id', auth, admin, async (req, res) => {
    try {
        const query = BlacklistedCaregiver.findById(req.params.id);
        const entry = typeof query?.select === 'function' ? await query.select('+photoFile +verificationDocuments') : await query;
        if (!entry) return res.status(404).json({ msg: 'Report not found' });
        await BlacklistedCaregiver.deleteOne({ _id: entry._id });
        const dir = privateDir || path.join(__dirname, '..', 'private');
        if (entry.photoFile) {
            fs.unlink(path.join(dir, path.basename(entry.photoFile)), () => {});
            if (typeof deleteStoredFile === 'function') await deleteStoredFile(entry.photoFile).catch(() => {});
        }
        for (const doc of (entry.verificationDocuments || [])) {
            fs.unlink(path.join(dir, path.basename(doc)), () => {});
            if (typeof deleteStoredFile === 'function') await deleteStoredFile(doc).catch(() => {});
        }
        return res.json({ msg: 'Report deleted' });
    } catch (_) {
        return res.status(500).json({ msg: 'Could not delete report' });
    }
});

router.patch('/admin/:id/review', auth, admin, async (req, res) => {
    const { status } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ msg: 'Choose approved or rejected status' });
    try {
        const entry = await BlacklistedCaregiver.findById(req.params.id);
        if (!entry) return res.status(404).json({ msg: 'Report not found' });
        if (entry.status !== 'pending') return res.status(409).json({ msg: 'This report has already been reviewed' });
        entry.status = status;
        entry.reviewedBy = req.user.id;
        entry.reviewedAt = new Date();
        await entry.save();
        return res.json({ id: entry._id, status: entry.status });
    } catch (_) { return res.status(500).json({ msg: 'Could not review report' }); }
});

router.get('/admin/:id/photo', auth, admin, async (req, res) => {
    try {
        const entry = await BlacklistedCaregiver.findById(req.params.id).select('+photoFile');
        if (!entry?.photoFile) return res.sendStatus(404);
        return serveFile(entry.photoFile, res);
    } catch (_) { return res.sendStatus(404); }
});

router.get('/admin/:id/documents/:index', auth, admin, async (req, res) => {
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index > 2) return res.sendStatus(404);
    try {
        const entry = await BlacklistedCaregiver.findById(req.params.id).select('+verificationDocuments');
        const file = entry?.verificationDocuments?.[index];
        if (!file) return res.sendStatus(404);
        return serveFile(file, res);
    } catch (_) { return res.sendStatus(404); }
});

router.get('/:id/photo', async (req, res) => {
    try {
        const entry = await BlacklistedCaregiver.findOne({ _id: req.params.id, status: 'approved' }).select('+photoFile');
        if (!entry?.photoFile) return res.sendStatus(404);
        return serveFile(entry.photoFile, res, { cacheControl: 'public, max-age=3600' });
    } catch (_) { return res.sendStatus(404); }
});

module.exports = router;
