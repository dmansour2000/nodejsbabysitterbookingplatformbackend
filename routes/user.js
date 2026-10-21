const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Babysitter = require('../models/Babysitter');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { sendPasswordResetEmail } = require('../utils/mailer');
const privateDir = path.join(__dirname, '..', 'private_uploads');

const router = express.Router();

function auth(req, res, next) {
    const authorization = req.header('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

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


// Get all users for admin panel
// Route to get users
router.get('/users', auth, async (req, res) => {
    try {
        // Fetch the current user information from database using the user ID
        const currentUser = await User.findById(req.user.id);

        if (!currentUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if the user has admin privileges
        if (currentUser.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }

        let users;
        
        if (currentUser.isSuperUser) {
            // Super user can see all users including admins but excluding themselves
            users = await User.find({ _id: { $ne: currentUser.id } }).select('-password');
        } else {
            // Regular admin can see all users except other admins
            users = await User.find({ role: { $ne: 'admin' } }).select('-password');
        }

        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Remove a user
router.delete('/users/:id', auth, async (req, res) => {
    try {
        const requester = await User.findById(req.user.id).select('role isSuperUser');
        if (!requester || requester.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }

        const userId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ msg: 'Invalid user ID format' });
        }
        if (userId === requester.id) {
            return res.status(400).json({ msg: 'You cannot delete your own account' });
        }
        
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        if (user.role === 'admin' && !requester.isSuperUser) {
            return res.status(403).json({ msg: 'Only a super user can remove an admin' });
        }

        await User.findByIdAndDelete(userId);
        const profile = await Babysitter.findOne({ userId: user._id }).select('+photoFile +nationalIdFile +passportFile +residencyFile');
        if (profile) {
            for (const filename of [profile.photoFile, profile.nationalIdFile, profile.passportFile, profile.residencyFile]) if (filename) fs.unlink(path.join(privateDir, filename), () => {});
            await Babysitter.deleteOne({ _id: profile._id });
            await Booking.deleteMany({ babysitterId: profile._id });
        }
        await Booking.deleteMany({ parentId: user._id });
        res.json({ msg: 'User removed' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get a user
router.get('/users/:id', auth, async (req, res) => {
    try {
        const requester = await User.findById(req.user.id).select('role');
        if (!requester || requester.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format' });
        }
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).send('Server error');
    }
});


// Issue a short-lived, signed nonce so Google credentials can be tied to this sign-in attempt.
router.post('/oauth/nonce', (req, res) => {
    const { provider } = req.body || {};
    if (provider !== 'google') return res.status(400).json({ msg: 'Unsupported social sign-in provider' });
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ msg: 'Social sign-in provider is not configured' });

    const nonce = jwt.sign({
        purpose: 'google-oauth-nonce',
        provider,
        nonceId: crypto.randomBytes(24).toString('hex'),
    }, process.env.JWT_SECRET, { expiresIn: '5m' });
    return res.json({ nonce });
});

// Verify a Google ID token and create or sign in to a user account.
router.post('/oauth', async (req, res) => {
    const { provider, credential, flow = 'login', nonce } = req.body || {};
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (provider !== 'google') return res.status(400).json({ msg: 'Unsupported social sign-in provider' });
    if (!clientId) return res.status(503).json({ msg: 'Social sign-in provider is not configured' });
    if (typeof credential !== 'string' || typeof nonce !== 'string') {
        return res.status(400).json({ msg: 'A Google credential and sign-in nonce are required' });
    }
    if (!['login', 'register'].includes(flow)) return res.status(400).json({ msg: 'Choose a valid sign-in flow' });

    try {
        const nonceClaims = jwt.verify(nonce, process.env.JWT_SECRET);
        if (nonceClaims.purpose !== 'google-oauth-nonce' || nonceClaims.provider !== 'google') {
            return res.status(401).json({ msg: 'Google sign-in nonce is invalid or expired' });
        }

        const googleClient = new OAuth2Client(clientId);
        let ticket;
        try {
            ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
        } catch (verificationError) {
            console.error('Google ID token verification failed:', verificationError.message);
            return res.status(401).json({ msg: 'Google credential could not be verified. Check the configured Google client ID.' });
        }
        const claims = ticket.getPayload();
        if (!claims || !claims.sub || !claims.email) {
            return res.status(401).json({ msg: 'Google credential is missing required account details' });
        }
        if (claims.nonce !== nonce) {
            return res.status(401).json({ msg: 'Google credential nonce does not match this sign-in attempt' });
        }
        if (claims.email_verified !== true) {
            return res.status(401).json({ msg: 'Google account email is not verified' });
        }

        const email = claims.email.trim().toLowerCase();
        let user = await User.findOne({ googleId: claims.sub });

        if (!user) {
            const matchingUsers = await User.find({ email }).limit(2);
            if (matchingUsers.length > 1) {
                return res.status(409).json({ msg: 'Email is already registered to another account' });
            }
            user = matchingUsers[0] || null;
            if (user?.role === 'admin' || (user?.googleId && user.googleId !== claims.sub)) {
                return res.status(409).json({ msg: 'Email is already registered to another account' });
            }

            if (user) {
                // Google has verified this email, so link it to the matching existing account.
                user.googleId = claims.sub;
                user.email = email;
                if (!user.name && claims.name) user.name = claims.name;
                await user.save();
            } else if (flow === 'register') {
                const registrationToken = jwt.sign({
                    purpose: 'google-registration',
                    provider: 'google',
                    sub: claims.sub,
                    email,
                    name: typeof claims.name === 'string' ? claims.name.trim().slice(0, 100) : '',
                }, process.env.JWT_SECRET, { expiresIn: '10m' });
                return res.json({
                    registrationRequired: true,
                    registrationToken,
                    googleUser: { email, name: typeof claims.name === 'string' ? claims.name.trim() : '' },
                });
            } else {
                return res.status(404).json({ msg: 'No account was found for this Google account. Register first.' });
            }
        }

        const payload = { user: { id: user.id, role: user.role, isSuperUser: user.isSuperUser } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token, user: payload.user });
    } catch (err) {
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return res.status(401).json({ msg: 'Google sign-in nonce is invalid or expired' });
        }
        if (err.code === 11000) {
            return res.status(409).json({ msg: 'Email is already registered to another account' });
        }
        console.error('Google sign-in account handling failed:', err.message);
        return res.status(500).json({ msg: 'Could not complete Google sign-in. Please try again.' });
    }
});


// Finish a Google sign-up only after the person chooses their CareNest account type.
router.post('/oauth/complete-registration', async (req, res) => {
    const { registrationToken, role } = req.body || {};
    if (typeof registrationToken !== 'string' || !['user', 'babysitter'].includes(role)) {
        return res.status(400).json({ msg: 'A valid registration token and account type are required' });
    }

    try {
        const pending = jwt.verify(registrationToken, process.env.JWT_SECRET);
        if (pending.purpose !== 'google-registration' || pending.provider !== 'google' || !pending.sub || !pending.email) {
            return res.status(401).json({ msg: 'Google registration session is invalid or expired' });
        }

        let user = await User.findOne({ googleId: pending.sub });
        if (!user) {
            const matchingUsers = await User.find({ email: pending.email }).limit(2);
            if (matchingUsers.length > 1 || matchingUsers[0]?.role === 'admin') {
                return res.status(409).json({ msg: 'Email is already registered to another account' });
            }
            user = matchingUsers[0] || null;
            if (user) {
                user.googleId = pending.sub;
                user.email = pending.email;
                if (!user.name && pending.name) user.name = pending.name;
                await user.save();
            } else {
                const localPart = (pending.email.split('@')[0] || 'google-user').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'google-user';
                let username = localPart;
                while (await User.exists({ username })) {
                    username = `${localPart}-${crypto.randomBytes(3).toString('hex')}`;
                }

                user = new User({
                    username,
                    name: pending.name || localPart,
                    email: pending.email,
                    googleId: pending.sub,
                    role,
                });
                await user.save();
                if (role === 'babysitter') {
                    await new Babysitter({ userId: user.id, name: user.name }).save();
                }
            }
        }

        const payload = { user: { id: user.id, role: user.role, isSuperUser: user.isSuperUser } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token, user: payload.user });
    } catch (err) {
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return res.status(401).json({ msg: 'Google registration session is invalid or expired' });
        }
        if (err.code === 11000) {
            return res.status(409).json({ msg: 'Email is already registered to another account' });
        }
        console.error('Google registration failed:', err.message);
        return res.status(500).json({ msg: 'Could not finish Google registration. Please try again.' });
    }
});


// Registration route
router.post('/register', async (req, res) => {
    const { username, email, password, name } = req.body;

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ msg: 'Username and a password of at least 8 characters are required' });
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

        // Create a new user
        user = new User({
            username: username.trim(),
            email: normalizedEmail,
            password,
            name: typeof name === 'string' ? name.trim() : '',
            role: 'user'
        });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save the user
        await user.save();

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


// Login user
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user?.password) return res.status(400).json({ msg: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

        const payload = {
            user: {
                id: user.id,
                role: user.role, // Ensure role is included
                isSuperUser: user.isSuperUser
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: payload.user }); // Send user info in response
            }
        );
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Update user password
router.patch('/password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ msg: 'New password must be at least 8 characters' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // If user already has a password set, verify currentPassword
        if (user.password) {
            if (typeof currentPassword !== 'string' || !currentPassword) {
                return res.status(400).json({ msg: 'Current password is incorrect' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ msg: 'Current password is incorrect' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ msg: 'Password updated successfully' });
    } catch (err) {
        console.error('Password update error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Update user email
router.patch('/email', auth, async (req, res) => {
    const { email, currentPassword } = req.body || {};

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ msg: 'A valid email address is required' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Verify current password if user has one
        if (user.password) {
            if (typeof currentPassword !== 'string' || !currentPassword) {
                return res.status(400).json({ msg: 'Current password is incorrect' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ msg: 'Current password is incorrect' });
            }
        }

        // Check if email is already registered to another account
        const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
        if (existing) {
            return res.status(409).json({ msg: 'Email address is already in use' });
        }

        user.email = normalizedEmail;
        await user.save();

        res.json({ msg: 'Email updated successfully', email: user.email });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ msg: 'Email address is already in use' });
        }
        console.error('Email update error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Request password recovery
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ msg: 'A valid email address is required' });
    }

    try {
        let user = await User.findOne({ email: normalizedEmail });
        
        // Support Resend's delivery simulation address (delivered@resend.dev) for testing
        if (!user && normalizedEmail === 'delivered@resend.dev') {
            user = { id: '000000000000000000000000', email: 'delivered@resend.dev', name: 'Resend Test Recipient' };
        }

        if (!user) {
            return res.json({ msg: 'If an account exists for that email, a password reset link has been sent.' });
        }

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error('[Forgot Password] RESEND_API_KEY is not configured');
            return res.status(503).json({ msg: 'Password recovery email is not configured' });
        }

        const token = jwt.sign(
            { id: user.id, purpose: 'password-reset' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const frontendUrl = process.env.FRONTEND_URL || 'https://dmansour2000.github.io/reactjsbabysitterbookingplatformfrontend';
        const cleanBaseUrl = frontendUrl.replace(/\/+$/, '');
        const resetUrl = `${cleanBaseUrl}/?token=${token}`;

        console.log(`[PASSWORD RESET LINK for ${user.email}]: ${resetUrl}`);

        try {
            await sendPasswordResetEmail({
                to: user.email,
                resetUrl,
                name: user.name || user.username,
            });
        } catch (mailError) {
            console.error('[Forgot Password] Email sending failed:', mailError.message);
            return res.status(500).json({ msg: 'Could not send recovery email. Please try again later.' });
        }

        res.json({ msg: 'If an account exists for that email, a password reset link has been sent.' });
    } catch (err) {
        console.error('[Forgot Password] Server error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (typeof token !== 'string' || !token) {
        return res.status(400).json({ msg: 'Reset token is required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ msg: 'New password must be at least 8 characters' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.purpose !== 'password-reset' || !decoded.id) {
            return res.status(400).json({ msg: 'Invalid or expired token' });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ msg: 'Password reset successful' });
    } catch (err) {
        return res.status(400).json({ msg: 'Invalid or expired token' });
    }
});

// Get user data
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;