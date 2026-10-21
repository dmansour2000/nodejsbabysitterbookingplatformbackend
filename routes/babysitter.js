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
const Review = require('../models/Review');
const { sendNotification } = require('../services/notificationService');
const { saveFileToDatabase, serveFile, deleteStoredFile, privateDir } = require('../utils/fileStorage');

const upload = multer({
    storage: multer.diskStorage({
        destination: privateDir,
        filename: (_req, file, cb) => {
            const ext = {
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/pjpeg': '.jpg',
                'image/png': '.png',
                'image/webp': '.webp',
                'image/heic': '.jpg',
                'image/heif': '.jpg',
                'application/pdf': '.pdf'
            }[file.mimetype.toLowerCase()] || path.extname(file.originalname) || '.jpg';
            cb(null, `${crypto.randomBytes(24).toString('hex')}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
        const photo = file.fieldname === 'photo';
        const isImage = /^image\/(jpe?g|png|webp|pjpeg|heic|heif)$/i.test(file.mimetype) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.originalname);
        const isDoc = isImage || file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
        const ok = photo ? isImage : isDoc;
        cb(ok ? null : new Error(photo ? 'Profile photo must be JPG, PNG, or WebP' : 'Only JPG, PNG, WebP, or PDF documents are accepted'), ok);
    }
});
const documentUpload = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'nationalId', maxCount: 1 },
    { name: 'passport', maxCount: 1 },
    { name: 'residency', maxCount: 1 },
    { name: 'documents', maxCount: 2 },
    { name: 'verificationDocuments', maxCount: 2 }
]);


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
        const babysitter = await Babysitter.findOne({ userId: req.user.id }).select('+photoFile +nationalIdFile +passportFile +residencyFile +verificationDocumentFiles');
        if (!babysitter) return res.status(404).json({ msg: 'Babysitter profile not found' });
        const profile = babysitter.toObject();
        profile.verificationDocuments = {
            nationalId: !!profile.nationalIdFile,
            passport: !!profile.passportFile,
            residency: !!profile.residencyFile,
            count: (profile.verificationDocumentFiles?.length) || (Boolean(profile.nationalIdFile) + Boolean(profile.passportFile))
        };
        profile.documentsCount = profile.verificationDocuments.count;
        profile.photoUrl = profile.photoFile ? '/api/babysitter/profile/photo' : null;
        delete profile.nationalIdFile; delete profile.passportFile; delete profile.residencyFile; delete profile.photoFile; delete profile.verificationDocumentFiles;
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
    try {
        const sitter = await Babysitter.findOne({ userId: req.user.id }).select('+photoFile +nationalIdFile +passportFile +residencyFile +verificationDocumentFiles');
        if (!sitter) return res.sendStatus(404);

        const index = parseInt(req.params.kind, 10);
        if (!isNaN(index) && sitter.verificationDocumentFiles && sitter.verificationDocumentFiles[index]) {
            return serveFile(sitter.verificationDocumentFiles[index], res);
        }
        const field = fieldByKind[req.params.kind];
        if (!field || !sitter[field]) return res.sendStatus(404);
        return serveFile(sitter[field], res);
    } catch (_) { res.sendStatus(404); }
});
// Update babysitter profile
router.put('/profile', auth, async (req, res) => {
    if (req.user.role !== 'babysitter') {
        return res.status(403).json({ msg: 'Access denied' });
    }
    const { name, phone, age, nationality, nationalityType, city, bio, monthlySalary, currency, services } = req.body;
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
        if (name !== undefined && typeof name === 'string' && name.trim()) {
            babysitter.name = name.trim();
            await User.updateOne({ _id: req.user.id }, { $set: { name: name.trim() } });
        }
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
        const sitter = await Babysitter.findOne({ userId: req.user.id }).select('+photoFile +nationalIdFile +passportFile +residencyFile +verificationDocumentFiles');
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

        // Handle up to 2 generic verification documents
        const uploadedDocs = files.documents || files.verificationDocuments || [];
        if (uploadedDocs.length > 0) {
            if (sitter.verificationDocumentFiles && sitter.verificationDocumentFiles.length > 0) {
                for (const oldDoc of sitter.verificationDocumentFiles) {
                    await deleteStoredFile(oldDoc);
                }
            }
            sitter.verificationDocumentFiles = [];
            for (const file of uploadedDocs.slice(0, 2)) {
                sitter.verificationDocumentFiles.push(file.filename);
                await saveFileToDatabase(file.filename, file.path, file.mimetype);
            }
            if (uploadedDocs[0]) {
                if (sitter.nationalIdFile) await deleteStoredFile(sitter.nationalIdFile);
                sitter.nationalIdFile = uploadedDocs[0].filename;
            }
            if (uploadedDocs[1]) {
                if (sitter.passportFile) await deleteStoredFile(sitter.passportFile);
                sitter.passportFile = uploadedDocs[1].filename;
            }
        }

        if (files.photo?.length && !files.photo[0].mimetype.startsWith('image/')) return res.status(400).json({ msg: 'Profile photo must be an image' });
        sitter.moderationStatus = 'pending'; await sitter.save();
        res.json({
            msg: 'Documents uploaded for review',
            moderationStatus: sitter.moderationStatus,
            photoUrl: sitter.photoFile ? '/api/babysitter/profile/photo' : null,
            documentsCount: (sitter.verificationDocumentFiles?.length) || (Boolean(sitter.nationalIdFile) + Boolean(sitter.passportFile))
        });
    } catch (err) { Object.values(files).flat().forEach((f) => fs.unlink(f.path, () => {})); res.status(500).json({ msg: 'Unable to save uploaded documents' }); }
});

async function getRatingStats(caregiverId) {
    try {
        const stats = await Review.aggregate([
            { $match: { caregiverId: new mongoose.Types.ObjectId(caregiverId) } },
            {
                $group: {
                    _id: '$caregiverId',
                    averageRating: { $avg: '$rating' },
                    ratingsCount: { $sum: 1 }
                }
            }
        ]);
        if (!stats || stats.length === 0) {
            return { averageRating: 5.0, ratingsCount: 0 };
        }
        return {
            averageRating: Number(stats[0].averageRating.toFixed(1)),
            ratingsCount: stats[0].ratingsCount
        };
    } catch (_) {
        return { averageRating: 5.0, ratingsCount: 0 };
    }
}

// Get all babysitters (show all approved caregivers, with busy status only if booked and accepted)
router.get('/', async (req, res) => {
    try {
        const [acceptedIds, ratingAggs, babysitters] = await Promise.all([
            Booking.distinct('babysitterId', { status: 'accepted' }),
            Review.aggregate([
                {
                    $group: {
                        _id: '$caregiverId',
                        averageRating: { $avg: '$rating' },
                        ratingsCount: { $sum: 1 }
                    }
                }
            ]),
            Babysitter.find({ moderationStatus: 'approved' }).select('+photoFile -nationalIdFile -passportFile -residencyFile -__v')
        ]);

        const ratingMap = new Map();
        ratingAggs.forEach((r) => {
            ratingMap.set(String(r._id), {
                averageRating: Number(r.averageRating.toFixed(1)),
                ratingsCount: r.ratingsCount
            });
        });

        res.json(babysitters.map((sitter) => {
            const profile = sitter.toObject();
            profile.photoUrl = profile.photoFile ? `/api/babysitter/photo/${sitter._id}` : null;
            const isBookedAndAccepted = sitter.hasAcceptedBooking === true || acceptedIds.some((id) => String(id) === String(sitter._id));
            profile.hasAcceptedBooking = Boolean(isBookedAndAccepted);
            profile.isBookedAndAccepted = Boolean(isBookedAndAccepted);
            profile.isAvailable = !isBookedAndAccepted;
            profile.available = !isBookedAndAccepted;

            const stats = ratingMap.get(String(sitter._id)) || { averageRating: 5.0, ratingsCount: 0 };
            profile.averageRating = stats.averageRating;
            profile.ratingsCount = stats.ratingsCount;

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

        const [accepted, stats, reviews] = await Promise.all([
            user.hasAcceptedBooking === true || await Booking.exists({ babysitterId: user._id, status: 'accepted' }),
            getRatingStats(user._id),
            Review.find({ caregiverId: user._id }).sort({ createdAt: -1 }).limit(30).lean()
        ]);

        const result = user.toObject();
        result.photoUrl = user.photoFile ? `/api/babysitter/photo/${user._id}` : null;
        result.hasAcceptedBooking = Boolean(accepted);
        result.isBookedAndAccepted = Boolean(accepted);
        result.isAvailable = !accepted;
        result.available = !accepted;
        result.averageRating = stats.averageRating;
        result.ratingsCount = stats.ratingsCount;
        result.reviews = reviews;

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

// Submit a review and star rating for a caregiver
router.post('/:id/reviews', auth, async (req, res) => {
    if (req.user.role !== 'user') {
        return res.status(403).json({ msg: 'Only registered family accounts can submit ratings and reviews' });
    }

    const { rating, title, description } = req.body || {};
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ msg: 'Please provide a star rating between 1 and 5' });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ msg: 'A review title is required' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ msg: 'A review description is required' });
    }

    try {
        const sitter = await Babysitter.findById(req.params.id);
        if (!sitter) {
            return res.status(404).json({ msg: 'Caregiver profile not found. Regular users cannot be rated.' });
        }
        if (sitter.userId && sitter.userId.toString() === req.user.id) {
            return res.status(400).json({ msg: 'You cannot rate your own profile' });
        }

        const reviewer = await User.findById(req.user.id).select('name username');
        const reviewerName = reviewer?.name || reviewer?.username || 'Family Member';

        const review = await Review.findOneAndUpdate(
            { caregiverId: sitter._id, userId: req.user.id },
            {
                $set: {
                    userName: reviewerName,
                    rating: numRating,
                    title: title.trim().slice(0, 120),
                    description: description.trim().slice(0, 1000),
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Notify the caregiver
        if (sitter.userId) {
            await sendNotification({
                recipientId: sitter.userId,
                type: 'rating_received',
                title: 'New Rating & Review ⭐',
                message: `${reviewerName} gave you a ${numRating}-star rating: "${title.trim()}"`,
                data: {
                    caregiverId: String(sitter._id),
                    rating: String(numRating),
                    reviewId: String(review._id),
                }
            });
        }

        const stats = await getRatingStats(sitter._id);
        res.status(201).json({
            msg: 'Review submitted successfully',
            review,
            stats,
        });
    } catch (err) {
        console.error('Failed to submit review:', err.message);
        res.status(500).json({ msg: 'Failed to submit review' });
    }
});

// Get reviews for a caregiver
router.get('/:id/reviews', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid caregiver ID' });
        }
        const [reviews, stats] = await Promise.all([
            Review.find({ caregiverId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean(),
            getRatingStats(req.params.id)
        ]);
        res.json({
            reviews,
            ...stats
        });
    } catch (err) {
        console.error('Failed to load reviews:', err.message);
        res.status(500).json({ msg: 'Failed to load reviews' });
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
                username: user.username,
                email: user.email,
                role: user.role,
                name: babysitter.name,
                photoUrl: null
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: payload.user });
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