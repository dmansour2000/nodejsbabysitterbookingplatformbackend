const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Babysitter = require('../models/Babysitter');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const { saveFileToDatabase, serveFile, deleteStoredFile, privateDir } = require('../utils/fileStorage');

const upload = multer({
    storage: multer.diskStorage({ destination: privateDir, filename: (_req, file, cb) => { const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }[file.mimetype] || ''; cb(null, `${crypto.randomBytes(24).toString('hex')}${ext}`); } }),
    limits: { fileSize: 5 * 1024 * 1024, files: 4 },
    fileFilter: (_req, file, cb) => { const photo = file.fieldname === 'photo'; const ok = photo ? /^image\/(jpeg|png|webp)$/.test(file.mimetype) : /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.mimetype); cb(ok ? null : new Error(photo ? 'Profile photo must be JPG, PNG, or WebP' : 'Only JPG, PNG, WebP, or PDF documents are accepted'), ok); }
});
const documentUpload = upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'nationalId', maxCount: 1 }, { name: 'passport', maxCount: 1 }, { name: 'residency', maxCount: 1 }]);


const router = express.Router();


function auth(req, res, next) {
    const authorization = req.header('Authorization');
    const token = (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null) || req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
}


// Read the signed-in babysitter's own profile.
router.get('/profile', auth, async (req, res) => {
    if (req.user.role !== 'babysitter') {
        return res.status(403).json({ msg: 'Access denied' });
    }
    try {
        const babysitter = await Babysitter.findOne({ userId: req.user.id }).select('+photoFile +nationalIdFile +passportFile +residencyFile');
        if (!babysitter) return res.status(404).json({ msg: 'Babysitter profile not found' });
        const profile = babysitter.toObject();
        profile.verificationDocuments = { nationalId: !!profile.nationalIdFile, passport: !!profile.passportFile, residency: !!profile.residencyFile };
        profile.photoUrl = profile.photoFile ? '/api/babysitter/profile/photo' : null;
        delete profile.nationalIdFile; delete profile.passportFile; delete profile.residencyFile; delete profile.photoFile;
        res.json(profile);
    } catch (err) {
        res.status(500).json({ msg: 'Unable to load profile' });
    }
});

// A babysitter may retrieve only files attached to their own profile.
router.get('/profile/photo', auth, async (req, res) => {
    if (req.user.role !== 'babysitter') return res.status(403).json({ msg: 'Access denied' });
    try {
        const sitter = await Babysitter.findOne({ userId: req.user.id }).select('+photoFile');
        if (!sitter?.photoFile) return res.sendStatus(404);
        return serveFile(sitter.photoFile, res);
    } catch (_) { res.sendStatus(404); }
});

router.get('/profile/documents/:kind', auth, async (req, res) => {
    if (req.user.role !== 'babysitter') return res.status(403).json({ msg: 'Access denied' });
    const fieldByKind = { nationalId: 'nationalIdFile', passport: 'passportFile', residency: 'residencyFile' };
    const field = fieldByKind[req.params.kind];
    if (!field) return res.sendStatus(404);
    try {
        const sitter = await Babysitter.findOne({ userId: req.user.id }).select('+' + field);
        if (!sitter?.[field]) return res.sendStatus(404);
        return serveFile(sitter[field], res);
    } catch (_) { res.sendStatus(404); }
});
// Update babysitter profile
router.put('/profile', auth, async (req, res) => {
    if (req.user.role !== 'babysitter') {
        return res.status(403).json({ msg: 'Access denied' });
    }
    const { phone, age, nationality, nationalityType, city, bio, monthlySalary, currency, services } = req.body;
    if (nationalityType !== undefined && !['egyptian', 'other'].includes(nationalityType)) return res.status(400).json({ msg: 'Choose a valid nationality document category' });
    if (currency !== undefined && !['EGP', 'USD'].includes(currency)) return res.status(400).json({ msg: 'Currency must be EGP or USD' });
    if (monthlySalary !== undefined && (!Number.isFinite(Number(monthlySalary)) || Number(monthlySalary) < 0)) return res.status(400).json({ msg: 'Monthly salary must be a non-negative number' });
    if (services !== undefined && (!Array.isArray(services) || services.some((service) => !['cleaning', 'babysitting', 'cooking', 'studying', 'elderlyCare'].includes(service)))) {
        return res.status(400).json({ msg: 'Choose valid services' });
    }
    if (bio !== undefined && (typeof bio !== 'string' || bio.length > 1500)) {
        return res.status(400).json({ msg: 'Bio must be 1500 characters or fewer' });
    }

    try {
        // Find the babysitter profile by user ID
        const babysitter = await Babysitter.findOne({ userId: req.user.id });

        if (!babysitter) {
            return res.status(404).json({ msg: 'Babysitter profile not found' });
        }

        // Update the profile fields
        if (phone !== undefined) babysitter.phone = phone;
        if (age !== undefined) babysitter.age = age;
        if (nationality !== undefined) babysitter.nationality = nationality;
        if (nationalityType !== undefined && babysitter.nationalityType !== nationalityType) { babysitter.nationalityType = nationalityType; babysitter.moderationStatus = 'pending'; }
        if (currency !== undefined) babysitter.currency = currency;
        if (city !== undefined) babysitter.city = city;
        if (bio !== undefined) babysitter.bio = bio;
        if (monthlySalary !== undefined) babysitter.monthlySalary = Number(monthlySalary);
        if (services !== undefined) babysitter.services = services;

        // Save the updated profile
        await babysitter.save();

        res.json({ msg: 'Profile updated successfully', babysitter });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


// Let a babysitter pause or resume incoming requests.
router.patch('/availability', auth, async (req, res) => {
    if (req.user.role !== 'babysitter') {
        return res.status(403).json({ msg: 'Access denied' });
    }
    if (typeof req.body.available !== 'boolean') {
        return res.status(400).json({ msg: 'Availability must be true or false' });
    }
    try {
        const babysitter = await Babysitter.findOneAndUpdate(
            { userId: req.user.id },
            { available: req.body.available },
            { new: true, runValidators: true }
        );
        if (!babysitter) return res.status(404).json({ msg: 'Babysitter profile not found' });
        res.json(babysitter);
    } catch (err) {
        res.status(500).json({ msg: 'Unable to update availability' });
    }
});


// An optional public photo is served only for an approved profile.
router.get('/photo/:id', async (req, res) => {
    try {
        const sitter = await Babysitter.findOne({ _id: req.params.id, moderationStatus: 'approved' }).select('+photoFile');
        if (!sitter || !sitter.photoFile) return res.sendStatus(404);
        return serveFile(sitter.photoFile, res, { cacheControl: 'public, max-age=3600' });
    } catch (_) { res.sendStatus(404); }
});

// Upload identity files to private storage; every new submission returns to admin review.
router.post('/profile/documents', auth, (req, res, next) => {
    if (req.user.role !== 'babysitter') return res.status(403).json({ msg: 'Access denied' });
    documentUpload(req, res, (err) => err ? res.status(400).json({ msg: err.message || 'Upload failed' }) : next());
}, async (req, res) => {
    const files = req.files || {};
    try {
        const sitter = await Babysitter.findOne({ userId: req.user.id }).select('+photoFile +nationalIdFile +passportFile +residencyFile');
        if (!sitter) { Object.values(files).flat().forEach((f) => fs.unlink(f.path, () => {})); return res.status(404).json({ msg: 'Babysitter profile not found' }); }
        const replace = async (key, field) => {
            if (!files[key]?.[0]) return;
            const file = files[key][0];
            if (sitter[field]) await deleteStoredFile(sitter[field]);
            sitter[field] = file.filename;
            await saveFileToDatabase(file.filename, file.path, file.mimetype);
        };
        await replace('photo', 'photoFile');
        await replace('nationalId', 'nationalIdFile');
        await replace('passport', 'passportFile');
        await replace('residency', 'residencyFile');
        if (files.photo?.length && !files.photo[0].mimetype.startsWith('image/')) return res.status(400).json({ msg: 'Profile photo must be an image' });
        sitter.moderationStatus = 'pending'; await sitter.save();
        res.json({ msg: 'Documents uploaded for review', moderationStatus: sitter.moderationStatus });
    } catch (err) { Object.values(files).flat().forEach((f) => fs.unlink(f.path, () => {})); res.status(500).json({ msg: 'Unable to save uploaded documents' }); }
});

// Get all babysitters (show all approved caregivers, with busy status only if booked and accepted)
router.get('/', async (req, res) => {
    try {
        const acceptedIds = await Booking.distinct('babysitterId', { status: 'accepted' });
        const babysitters = await Babysitter.find({ moderationStatus: 'approved' }).select('+photoFile -nationalIdFile -passportFile -residencyFile -__v');
        res.json(babysitters.map((sitter) => {
            const profile = sitter.toObject();
            profile.photoUrl = profile.photoFile ? `/api/babysitter/photo/${sitter._id}` : null;
            const isBookedAndAccepted = sitter.hasAcceptedBooking === true || acceptedIds.some((id) => String(id) === String(sitter._id));
            profile.hasAcceptedBooking = Boolean(isBookedAndAccepted);
            profile.isBookedAndAccepted = Boolean(isBookedAndAccepted);
            profile.isAvailable = !isBookedAndAccepted;
            profile.available = !isBookedAndAccepted;
            delete profile.phone;
            delete profile.photoFile;
            delete profile.nationalIdFile;
            delete profile.passportFile;
            delete profile.residencyFile;
            return profile;
        })); 
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Get a babysitter profile
router.get('/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = mongoose.Types.ObjectId.isValid(id)
            ? { $or: [{ userId: id }, { _id: id }], moderationStatus: 'approved' }
            : { userId: id, moderationStatus: 'approved' };
        const user = await Babysitter.findOne(query).select('+photoFile -nationalIdFile -passportFile -residencyFile -__v');
        if (!user) return res.status(404).json({ msg: 'Babysitter profile is not available' });
        const accepted = user.hasAcceptedBooking === true || await Booking.exists({ babysitterId: user._id, status: 'accepted' });
        const result = user.toObject();
        result.photoUrl = user.photoFile ? `/api/babysitter/photo/${user._id}` : null;
        result.hasAcceptedBooking = Boolean(accepted);
        result.isBookedAndAccepted = Boolean(accepted);
        result.isAvailable = !accepted;
        result.available = !accepted;
        delete result.phone;
        delete result.photoFile;
        delete result.nationalIdFile;
        delete result.passportFile;
        delete result.residencyFile;
        res.json(result);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Register a new babysitter
router.post('/register', async (req, res) => {
    const { username, email, password, name, phone, age, nationality, services } = req.body;
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 8 || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ msg: 'Name, username, and a password of at least 8 characters are required' });
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ msg: 'A valid email address is required' });
    }

    try {
        // Check if the user already exists
        let user = await User.findOne({ username: username.trim() });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }
        if (await User.findOne({ email: normalizedEmail })) {
            return res.status(409).json({ msg: 'Email is already registered to another account' });
        }

        // Create a new user with the role of 'babysitter'
        user = new User({
            username: username.trim(),
            email: normalizedEmail,
            password,
            name: name.trim(),
            role: 'babysitter'
        });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save the user
        await user.save();

        // Create a new babysitter profile
        const babysitter = new Babysitter({
            userId: user.id,
            name,
            phone,
            age,
            nationality,
            services
        });

        // Save the babysitter profile
        await babysitter.save();

        // Generate a JWT token
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});



// Accept work request
router.put('/accept/:id', auth, async (req, res) => {
    try {
        const babysitter = await Babysitter.findById(req.params.id);
        if (!babysitter) return res.status(404).json({ msg: 'Babysitter not found' });

        if (babysitter.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        babysitter.available = false;
        await babysitter.save();
        res.json(babysitter);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;