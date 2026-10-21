const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const proxyquire = require('proxyquire').noCallThru();
const request = require('supertest');

process.env.JWT_SECRET = 'route-test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
const parentId = '64a000000000000000000010';
const caregiverUserId = '64a000000000000000000011';
const caregiverProfileId = '64a000000000000000000012';
let loginUser = { id: parentId, _id: parentId, username: 'family', role: 'user', password: 'hashed-password' };
let googlePayload = null;
let comparePassword = true;
let publicProfiles = [];
let detailedProfile = null;
let requestedFilter;
let detailFilter;
let detailHasAcceptedBooking = false;
const acceptedCaregiverIds = [caregiverProfileId];

const userModel = {
  findOne: async (filter = {}) => {
    if (filter.email && filter._id?.$ne) return null;
    return (filter.username || filter.email) ? loginUser : null;
  },
  find: () => ({ limit: async () => [] }),
  findById: (id) => {
    const user = { _id: id || parentId, id: id || parentId, role: 'user', username: 'family', name: 'Family', password: 'hashed-password', email: 'family@example.com', save: async () => {} };
    return Object.assign(Promise.resolve(user), { select: async () => user });
  },
};
const userRouter = proxyquire('../routes/user', {
  '../models/User': userModel,
  '../models/Babysitter': {},
  '../models/Booking': {},
  '../utils/mailer': { sendPasswordResetEmail: async () => ({ id: 'mock-mail-id' }) },
  'google-auth-library': { OAuth2Client: class { async verifyIdToken() { return { getPayload: () => googlePayload }; } } },
  bcryptjs: {
    compare: async (candidate) => comparePassword && candidate === 'correct-password',
    genSalt: async () => 'salt',
    hash: async (pwd) => 'hashed-' + pwd,
  },
});
const userApp = express();
userApp.use(express.json());
userApp.use('/api/user', userRouter);
const familyToken = jwt.sign({ user: { id: parentId, role: 'user' } }, process.env.JWT_SECRET);

function fakeMulter() {
  return { fields: () => (_req, _res, next) => next() };
}
fakeMulter.diskStorage = () => ({});
const caregiverModel = {
  find: (filter) => {
    requestedFilter = filter;
    return { select: async () => publicProfiles };
  },
  findOne: (filter) => {
    detailFilter = filter;
    return { select: async () => detailedProfile };
  },
};
const caregiverRouter = proxyquire('../routes/babysitter', {
  '../models/User': {},
  '../models/Babysitter': caregiverModel,
  '../models/Booking': { distinct: async () => acceptedCaregiverIds, exists: async () => detailHasAcceptedBooking },
  multer: fakeMulter,
  fs: { mkdirSync() {}, unlink(_file, callback) { callback?.(); } },
});
const caregiverApp = express();
caregiverApp.use(express.json());
caregiverApp.use('/api/babysitter', caregiverRouter);

const bookingAccount = { _id: parentId, id: parentId, role: 'user', username: 'family', name: 'Family' };
let bookingDocumentForStatus = null;
let bookingLookupCount = 0;
const bookingStub = {
  findById: () => {
    bookingLookupCount += 1;
    if (bookingLookupCount === 1) return Promise.resolve(bookingDocumentForStatus);
    const result = { ...bookingDocumentForStatus };
    return { populate() { return this; }, sort() { return Promise.resolve(result); } };
  },
};
const bookingRouter = proxyquire('../routes/bookings', {
  '../models/User': { findById: (id) => ({ select: async () => id === caregiverUserId ? { ...bookingAccount, role: 'babysitter' } : bookingAccount }) },
  '../models/Babysitter': {},
  '../models/Booking': bookingStub,
});
const bookingApp = express();
bookingApp.use(express.json());
bookingApp.use('/api/bookings', bookingRouter);
const bookingToken = jwt.sign({ user: { id: parentId, role: 'user' } }, process.env.JWT_SECRET);
const validBookingBody = {
  babysitterId: caregiverProfileId,
  service: 'babysitting',
  startAt: '2099-06-01',
  endAt: '2099-06-02',
  childrenCount: 1,
};

test('login rejects an incorrect password and returns a signed user session for valid credentials', async () => {
  comparePassword = false;
  const rejected = await request(userApp).post('/api/user/login').send({ username: 'family', password: 'wrong-password' });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.msg, 'Invalid credentials');

  comparePassword = true;
  const accepted = await request(userApp).post('/api/user/login').send({ username: 'family', password: 'correct-password' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.user.role, 'user');
  assert.equal(typeof accepted.body.token, 'string');
});

test('login rejects admin accounts attempting to log in from mobile client', async () => {
  comparePassword = true;
  loginUser = { id: parentId, _id: parentId, username: 'adminuser', role: 'admin', password: 'hashed-password' };

  const headerRejected = await request(userApp)
    .post('/api/user/login')
    .set('x-client-platform', 'mobile')
    .send({ username: 'adminuser', password: 'correct-password' });
  assert.equal(headerRejected.status, 403);
  assert.match(headerRejected.body.msg, /Admin accounts can only be accessed through the web admin dashboard/i);

  const bodyRejected = await request(userApp)
    .post('/api/user/login')
    .send({ username: 'adminuser', password: 'correct-password', platform: 'mobile' });
  assert.equal(bodyRejected.status, 403);

  const webAccepted = await request(userApp)
    .post('/api/user/login')
    .send({ username: 'adminuser', password: 'correct-password' });
  assert.equal(webAccepted.status, 200);
  assert.equal(webAccepted.body.user.role, 'admin');

  loginUser = { id: parentId, _id: parentId, username: 'family', role: 'user', password: 'hashed-password' };
});



test('Google sign-in nonce endpoint issues a short-lived signed nonce', async () => {
  const response = await request(userApp)
    .post('/api/user/oauth/nonce')
    .send({ provider: 'google' });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.nonce, 'string');
  const claims = jwt.verify(response.body.nonce, process.env.JWT_SECRET);
  assert.equal(claims.purpose, 'google-oauth-nonce');
  assert.equal(claims.provider, 'google');
});

test('Google OAuth rejects credentials without a valid nonce before token verification', async () => {
  const response = await request(userApp)
    .post('/api/user/oauth')
    .send({ provider: 'google', credential: 'invalid-token', nonce: 'invalid-nonce' });

  assert.equal(response.status, 401);
  assert.equal(response.body.msg, 'Google sign-in nonce is invalid or expired');
});


test('new Google registrants receive a pending registration token before choosing an account type', async () => {
  const nonceResponse = await request(userApp)
    .post('/api/user/oauth/nonce')
    .send({ provider: 'google' });
  googlePayload = {
    sub: 'google-user-subject',
    email: 'new-google-user@example.com',
    email_verified: true,
    name: 'New Google User',
    nonce: nonceResponse.body.nonce,
  };

  const response = await request(userApp)
    .post('/api/user/oauth')
    .send({ provider: 'google', flow: 'register', credential: 'verified-google-token', nonce: nonceResponse.body.nonce });

  assert.equal(response.status, 200);
  assert.equal(response.body.registrationRequired, true);
  const claims = jwt.verify(response.body.registrationToken, process.env.JWT_SECRET);
  assert.equal(claims.purpose, 'google-registration');
  assert.equal(claims.email, 'new-google-user@example.com');
});

test('Google registration completion requires a supported account type', async () => {
  const response = await request(userApp)
    .post('/api/user/oauth/complete-registration')
    .send({ registrationToken: 'pending-token', role: 'admin' });

  assert.equal(response.status, 400);
});

test('family registration enforces a minimum password length', async () => {
  const response = await request(userApp)
    .post('/api/user/register')
    .send({ username: 'new-family', password: 'short' });

  assert.equal(response.status, 400);
  assert.match(response.body.msg, /at least 8 characters/);
});

test('caregiver registration validates required identity fields before creating an account', async () => {
  const response = await request(caregiverApp)
    .post('/api/babysitter/register')
    .send({ username: 'new-caregiver', password: 'short', name: '' });

  assert.equal(response.status, 400);
  assert.match(response.body.msg, /Name, username/);
});

test('caregiver profile updates reject unsupported salary currencies', async () => {
  const caregiverToken = jwt.sign({ user: { id: caregiverUserId, role: 'babysitter' } }, process.env.JWT_SECRET);
  const response = await request(caregiverApp)
    .put('/api/babysitter/profile')
    .set('Authorization', 'Bearer ' + caregiverToken)
    .send({ currency: 'EUR' });

  assert.equal(response.status, 400);
  assert.equal(response.body.msg, 'Currency must be EGP or USD');
});

test('booking endpoints reject missing authentication and caregiver accounts creating requests', async () => {
  const unauthorized = await request(bookingApp).get('/api/bookings');
  assert.equal(unauthorized.status, 401);

  const caregiverToken = jwt.sign({ user: { id: caregiverUserId, role: 'babysitter' } }, process.env.JWT_SECRET);
  const denied = await request(bookingApp)
    .post('/api/bookings')
    .set('Authorization', 'Bearer ' + caregiverToken)
    .send(validBookingBody);
  assert.equal(denied.status, 403);
});

test('booking validation rejects services removed from the platform', async () => {
  const response = await request(bookingApp)
    .post('/api/bookings')
    .set('Authorization', 'Bearer ' + bookingToken)
    .send({ ...validBookingBody, service: 'studying' });

  assert.equal(response.status, 400);
  assert.equal(response.body.msg, 'Choose a valid service');
});


test('public caregiver profile endpoints require approval and never return phone or identity documents', async () => {
  detailedProfile = {
    _id: caregiverProfileId,
    name: 'Mona',
    phone: '01012345678',
    photoFile: 'private-photo.jpg',
    nationalIdFile: 'private-id.pdf',
    moderationStatus: 'approved',
    toObject() {
      return { _id: this._id, name: this.name, phone: this.phone, photoFile: this.photoFile, nationalIdFile: this.nationalIdFile };
    },
  };
  const response = await request(caregiverApp)
    .get('/api/babysitter/users/' + caregiverUserId)
    .set('Authorization', 'Bearer ' + familyToken);

  assert.equal(response.status, 200);
  assert.equal(response.body.name, 'Mona');
  assert.equal(response.body.phone, undefined);
  assert.equal(response.body.nationalIdFile, undefined);
  assert.equal(response.body.photoUrl, '/api/babysitter/photo/' + caregiverProfileId);
  assert.equal(detailFilter.moderationStatus, 'approved');

  detailHasAcceptedBooking = true;
  const booked = await request(caregiverApp)
    .get('/api/babysitter/users/' + caregiverUserId)
    .set('Authorization', 'Bearer ' + familyToken);
  assert.equal(booked.status, 200);
  assert.equal(booked.body.available, false);
  assert.equal(booked.body.isBookedAndAccepted, true);
  detailHasAcceptedBooking = false;
});


test('family account can cancel an active booking while retaining its history', async () => {
  const bookingId = '64a000000000000000000014';
  let saveCalled = false;
  bookingLookupCount = 0;
  bookingDocumentForStatus = {
    _id: bookingId,
    parentId: { equals: (id) => id === parentId },
    babysitterId: caregiverProfileId,
    status: 'pending',
    startAt: new Date('2099-06-01T00:00:00.000Z'),
    endAt: new Date('2099-06-02T23:59:59.999Z'),
    save: async function save() { saveCalled = true; },
  };
  const response = await request(bookingApp)
    .patch('/api/bookings/' + bookingId + '/status')
    .set('Authorization', 'Bearer ' + bookingToken)
    .send({ status: 'cancelled' });

  assert.equal(response.status, 200);
  assert.equal(saveCalled, true);
  assert.equal(response.body.status, 'cancelled');
});
test('public caregiver search excludes unavailable and accepted caregivers and omits private contact and identity data', async () => {
  publicProfiles = [
    {
      _id: '64a000000000000000000013',
      name: 'Mona',
      phone: '01012345678',
      moderationStatus: 'approved',
      photoFile: 'private-photo.jpg',
      nationalIdFile: 'private-id.pdf',
      toObject() {
        return { _id: this._id, name: this.name, phone: this.phone, photoFile: this.photoFile, nationalIdFile: this.nationalIdFile };
      },
    },
  ];
  const response = await request(caregiverApp).get('/api/babysitter');

  assert.equal(response.status, 200);
  assert.equal(response.body[0].name, 'Mona');
  assert.equal(response.body[0].phone, undefined);
  assert.equal(response.body[0].nationalIdFile, undefined);
  assert.equal(response.body[0].photoUrl, '/api/babysitter/photo/64a000000000000000000013');
  assert.equal(requestedFilter.moderationStatus, 'approved');
  assert.equal(response.body[0].available, true);
});

test('PATCH /api/user/password rejects incorrect current password and updates with valid credentials', async () => {
  comparePassword = false;
  const rejected = await request(userApp)
    .patch('/api/user/password')
    .set('Authorization', 'Bearer ' + familyToken)
    .send({ currentPassword: 'wrong-password', newPassword: 'new-secure-password' });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.msg, 'Current password is incorrect');

  comparePassword = true;
  const accepted = await request(userApp)
    .patch('/api/user/password')
    .set('Authorization', 'Bearer ' + familyToken)
    .send({ currentPassword: 'correct-password', newPassword: 'new-secure-password' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.msg, 'Password updated successfully');
});

test('PATCH /api/user/email updates the user email address when current password matches', async () => {
  comparePassword = false;
  const rejected = await request(userApp)
    .patch('/api/user/email')
    .set('Authorization', 'Bearer ' + familyToken)
    .send({ email: 'new-email@example.com', currentPassword: 'wrong-password' });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.msg, 'Current password is incorrect');

  comparePassword = true;
  const accepted = await request(userApp)
    .patch('/api/user/email')
    .set('Authorization', 'Bearer ' + familyToken)
    .send({ email: 'new-email@example.com', currentPassword: 'correct-password' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.email, 'new-email@example.com');
});

test('POST /api/user/forgot-password sends a password reset link and reset-password updates the password', async () => {
  process.env.RESEND_API_KEY = 'test-resend-key';
  const forgotResponse = await request(userApp)
    .post('/api/user/forgot-password')
    .send({ email: 'family@example.com' });
  assert.equal(forgotResponse.status, 200);

  const resetToken = jwt.sign({ id: parentId, purpose: 'password-reset' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const resetResponse = await request(userApp)
    .post('/api/user/reset-password')
    .send({ token: resetToken, newPassword: 'brand-new-password123' });
  assert.equal(resetResponse.status, 200);
  assert.equal(resetResponse.body.msg, 'Password reset successful');
});
