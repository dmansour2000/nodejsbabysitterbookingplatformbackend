const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const proxyquire = require('proxyquire').noCallThru();
const request = require('supertest');
const Babysitter = require('../models/Babysitter');
const BookingModel = require('../models/Booking');

const targetId = '64a000000000000000000001';
const adminId = '64a000000000000000000002';
const currentAdmin = { _id: adminId, role: 'admin', isSuperUser: false };
let targetUser;
let profile;
let bookingRows;

const UserStub = {
  findById(id) {
    return {
      select(selection) {
        if (id === adminId) return Promise.resolve(currentAdmin);
        return {
          lean: async () => targetUser,
        };
      },
    };
  },
};
const BabysitterStub = {
  findOne() {
    return {
      select() {
        return { lean: async () => profile };
      },
    };
  },
};
const BookingStub = {
  find() {
    return {
      populate() {
        return {
          sort() {
            return { lean: async () => bookingRows };
          },
        };
      },
    };
  },
};

process.env.JWT_SECRET = 'unit-test-secret';
const adminRouter = proxyquire('../routes/admin', {
  '../models/User': UserStub,
  '../models/Babysitter': BabysitterStub,
  '../models/Booking': BookingStub,
});
const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
const token = jwt.sign({ user: { id: adminId } }, process.env.JWT_SECRET);

test('caregiver service schema allows supported services and excludes studying', () => {
  assert.deepEqual(Babysitter.schema.path('services').caster.enumValues, [
    'cleaning',
    'babysitting',
    'cooking',
    'elderlyCare',
  ]);
});

test('booking schema permits only the supported lifecycle states', () => {
  assert.deepEqual(BookingModel.schema.path('status').enumValues, [
    'pending',
    'accepted',
    'declined',
    'cancelled',
  ]);
});

test('account details return a regular users booking history with caregiver names', async () => {
  targetUser = { _id: targetId, username: 'family', role: 'user' };
  bookingRows = [{ _id: '64a000000000000000000003', status: 'accepted', service: 'babysitting', babysitterId: { name: 'Mona' } }];

  // Regular (non-super) admin should be blocked from viewing user accounts
  const blocked = await request(app)
    .get('/api/admin/users/' + targetId + '/details')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(blocked.status, 403);

  // Super admin can view any account
  const superAdminRouter = proxyquire('../routes/admin', {
    '../models/User': {
      findById(id) {
        return {
          select() {
            if (id === adminId) return Promise.resolve({ _id: adminId, role: 'admin', isSuperUser: true });
            return { lean: async () => targetUser };
          },
        };
      },
    },
    '../models/Babysitter': BabysitterStub,
    '../models/Booking': BookingStub,
  });
  const superApp = express();
  superApp.use(express.json());
  superApp.use('/api/admin', superAdminRouter);
  const response = await request(superApp)
    .get('/api/admin/users/' + targetId + '/details')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(response.status, 200);
  assert.equal(response.body.user.username, 'family');
  assert.equal(response.body.requests[0].babysitterName, 'Mona');
});

test('account details return caregiver profile fields and document availability without file names', async () => {
  targetUser = { _id: targetId, username: 'mona', role: 'babysitter' };
  profile = {
    _id: '64a000000000000000000004',
    name: 'Mona',
    phone: '01000000000',
    moderationStatus: 'approved',
    photoFile: 'private-photo.jpg',
    nationalIdFile: 'private-id.pdf',
    passportFile: undefined,
    residencyFile: undefined,
  };

  const response = await request(app)
    .get('/api/admin/users/' + targetId + '/details')
    .set('Authorization', 'Bearer ' + token);

  assert.equal(response.status, 200);
  assert.equal(response.body.profile.name, 'Mona');
  assert.equal(response.body.documents.photo, true);
  assert.equal(response.body.documents.nationalId, true);
  assert.equal(response.body.documents.passport, false);
  assert.equal(response.body.profile.photoFile, undefined);
  assert.equal(response.body.profile.nationalIdFile, undefined);
});

test('regular admins cannot view another admin account', async () => {
  targetUser = { _id: targetId, username: 'other-admin', role: 'admin', isSuperUser: false };

  const response = await request(app)
    .get('/api/admin/users/' + targetId + '/details')
    .set('Authorization', 'Bearer ' + token);

  assert.equal(response.status, 403);
});

test('regular admins cannot delete regular user accounts or caregiver profiles', async () => {
  const UserDeleteStub = {
    findById(id) {
      return {
        select() {
          if (id === adminId) return Promise.resolve(currentAdmin);
          return Promise.resolve({ _id: targetId, role: 'user', _id: { equals: () => false } });
        },
      };
    },
    findByIdAndDelete: async () => {},
  };
  const BabysitterDeleteStub = {
    findById: async () => null,
    findByIdAndDelete: async () => {},
    findOne: async () => null,
    findOneAndDelete: async () => null,
  };

  const restrictedRouter = proxyquire('../routes/admin', {
    '../models/User': UserDeleteStub,
    '../models/Babysitter': BabysitterDeleteStub,
    '../models/Booking': { deleteMany: async () => {} },
  });
  const restrictedApp = express();
  restrictedApp.use(express.json());
  restrictedApp.use('/api/admin', restrictedRouter);

  // Regular admin cannot delete a regular user
  const userDeleteBlocked = await request(restrictedApp)
    .delete('/api/admin/users/' + targetId)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(userDeleteBlocked.status, 403);

  // Regular admin cannot delete (remove) a caregiver profile
  const sitterDeleteBlocked = await request(restrictedApp)
    .delete('/api/admin/babysitters/' + targetId)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(sitterDeleteBlocked.status, 403);
});
