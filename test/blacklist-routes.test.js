const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const proxyquire = require('proxyquire').noCallThru();
const request = require('supertest');

process.env.JWT_SECRET = 'blacklist-route-test-secret';
const regularUserId = '64a000000000000000000020';
const adminId = '64a000000000000000000021';
const reportId = '64a000000000000000000022';
let approvedEntries = [{ _id: reportId, name: 'Approved person', nationality: 'Egypt', age: 32, reason: 'Approved report content', photoFile: 'private.png', verificationDocuments: ['private.pdf'], submittedBy: regularUserId }];
let reviewEntries = [{ _id: reportId, name: 'Pending person', nationality: 'Sudan', reason: 'Pending report content', photoFile: 'private.png', verificationDocuments: ['private.pdf'] }];
let createdEntry;
let savedEntry;
let lastFindFilter;

const model = {
  find(filter) {
    lastFindFilter = filter;
    const query = {
      select() { return this; },
      sort() { return this; },
      async lean() { return filter.status === 'approved' ? approvedEntries : filter.status === 'pending' ? reviewEntries : []; },
    };
    return query;
  },
  async create(value) { createdEntry = { ...value, _id: reportId, status: value.status }; return createdEntry; },
  findById: async () => savedEntry,
  findOne: async (filter) => filter.status === 'approved' ? { photoFile: 'private.png' } : null,
};
function fakeMulter() {
  return { fields: () => (req, _res, next) => {
    req.body = { name: 'New report', nationality: 'Egypt', reason: 'A complete firsthand reason.' };
    req.files = {
      photo: [{ filename: 'photo.png' }],
      documents: [{ filename: 'proof.pdf' }],
    };
    next();
  } };
}
fakeMulter.diskStorage = () => ({});
const router = proxyquire('../routes/blacklist', {
  '../models/User': { findById: () => ({ select: async () => ({ role: 'admin' }) }) },
  '../models/BlacklistedCaregiver': model,
  '../utils/fileStorage': { deleteStoredFile: async () => {}, storeUploadedFile: async () => {}, getStoredFileStream: async () => null },
  multer: fakeMulter,
  fs: { mkdirSync() {}, unlink(_file, callback) { callback?.(); } },
});
const app = express();
app.use(express.json());
app.use('/api/blacklist', router);
const userToken = jwt.sign({ user: { id: regularUserId, role: 'user' } }, process.env.JWT_SECRET);
const adminToken = jwt.sign({ user: { id: adminId, role: 'admin' } }, process.env.JWT_SECRET);

test('public blacklist contains approved reports only and omits verification documents and submitter identity', async () => {
  const response = await request(app).get('/api/blacklist');
  assert.equal(response.status, 200);
  assert.equal(lastFindFilter.status, 'approved');
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].photoUrl, `/api/blacklist/${reportId}/photo`);
  assert.equal(response.body[0].photoFile, undefined);
  assert.equal(response.body[0].verificationDocuments, undefined);
  assert.equal(response.body[0].submittedBy, undefined);
});

test('only signed-in regular users can submit reports and new reports stay pending', async () => {
  const denied = await request(app).post('/api/blacklist').send({ name: 'Someone', nationality: 'Egypt', reason: 'A complete firsthand reason.' });
  assert.equal(denied.status, 401);

  const response = await request(app)
    .post('/api/blacklist')
    .set('Authorization', `Bearer ${userToken}`)
    .field('name', 'New report')
    .field('nationality', 'Egypt')
    .field('reason', 'A complete firsthand reason.')
    .attach('photo', Buffer.from('image'), 'photo.png');
  assert.equal(response.status, 201);
  assert.equal(createdEntry.status, 'pending');
  assert.equal(createdEntry.submittedBy, regularUserId);
});

test('only admins can review pending submissions', async () => {
  const response = await request(app)
    .get('/api/blacklist/admin/review')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(response.status, 200);
  assert.equal(lastFindFilter.status, 'pending');
  assert.equal(response.body[0].documentCount, 1);
  assert.equal(response.body[0].photoFile, undefined);
  assert.equal(response.body[0].verificationDocuments, undefined);
});

test('admins can approve a pending report, after which it becomes publicly listed', async () => {
  savedEntry = {
    _id: reportId,
    status: 'pending',
    async save() { return this; },
  };
  const response = await request(app)
    .patch(`/api/blacklist/admin/${reportId}/review`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'approved' });
  assert.equal(response.status, 200);
  assert.equal(savedEntry.status, 'approved');
  assert.equal(savedEntry.reviewedBy, adminId);
});

test('admins can delete any report and its files are cleaned up', async () => {
  const photoFilename = 'photo-to-delete.png';
  const docFilename = 'doc-to-delete.pdf';
  let unlinkedFiles = [];
  const deleteRouter = proxyquire('../routes/blacklist', {
    '../models/User': { findById: () => ({ select: async () => ({ role: 'admin' }) }) },
    '../models/BlacklistedCaregiver': {
      ...model,
      findById: async () => ({
        _id: reportId,
        photoFile: photoFilename,
        verificationDocuments: [docFilename],
      }),
      deleteOne: async () => {},
    },
    '../utils/fileStorage': { deleteStoredFile: async () => {}, storeUploadedFile: async () => {}, getStoredFileStream: async () => null },
    multer: fakeMulter,
    fs: {
      mkdirSync() {},
      unlink(file, callback) { unlinkedFiles.push(file); callback?.(); },
    },
  });
  const deleteApp = express();
  deleteApp.use(express.json());
  deleteApp.use('/api/blacklist', deleteRouter);

  const response = await request(deleteApp)
    .delete(`/api/blacklist/admin/${reportId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.msg, 'Report deleted');
  assert.ok(unlinkedFiles.some((f) => f.endsWith(photoFilename)), 'photo file should be unlinked');
  assert.ok(unlinkedFiles.some((f) => f.endsWith(docFilename)), 'document file should be unlinked');
});

test('non-admins cannot delete reports', async () => {
  const response = await request(app)
    .delete(`/api/blacklist/admin/${reportId}`)
    .set('Authorization', `Bearer ${userToken}`);
  assert.equal(response.status, 403);
});
