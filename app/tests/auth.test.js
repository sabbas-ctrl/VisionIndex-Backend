/* eslint-env mocha */
import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';

const ADMIN_EMAIL = 'sabbbas.a30@gmail.com';
const ADMIN_PASSWORD = 'Admin123!';

const results = [];

let adminToken = null;
let adminRefreshToken = null;
let adminId = null;
let viewerEmail = `viewer_${Date.now()}@test.com`; // unique per run
let viewerPassword = 'Viewer123!';

describe('Auth API - Full Supertest Suite', function () {
  this.timeout(15000);

  before(async () => {
    try {
      console.log('🔹 Connecting to DB for tests...');
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI);
      }
      console.log('Connected to MongoDB');

      // ensure admin exists (create if missing)
      let admin = await User.findOne({ email: ADMIN_EMAIL });
      if (!admin) {
        console.log('⚠️  Admin not found — creating via /auth/dev-register ...');
        const devRes = await request(app).post('/auth/dev-register');
        console.log('dev-register response:', devRes.status, devRes.body);
        if (![201, 400].includes(devRes.status)) {
          throw new Error(`dev-register failed: ${devRes.status} ${JSON.stringify(devRes.body)}`);
        }
      } else {
        console.log('Admin already present in DB.');
      }

      // login as admin for tokens
      console.log('🔹 Logging in as admin...');
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      if (loginRes.status !== 200) {
        console.error('Admin login response:', loginRes.status, loginRes.body);
        throw new Error(`Admin login failed: ${loginRes.status} - ${JSON.stringify(loginRes.body)}`);
      }

      adminToken = loginRes.body.accessToken;
      adminRefreshToken = loginRes.body.refreshToken;
      adminId = (await User.findOne({ email: ADMIN_EMAIL }))._id;

      console.log('✅ Admin login successful. Tokens obtained.');
    } catch (err) {
      console.error('BEFORE HOOK ERROR:', err);
      throw err; // abort tests if setup fails
    }
  });

  after(async () => {
    try {
      console.log('🔹 Tests complete — summary:');
      results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.name} — ${r.status.toUpperCase()}`);
        if (r.status === 'failed') {
          if (r.error) console.log(`   error: ${r.error}`);
          if (r.body) console.log(`   response body: ${JSON.stringify(r.body)}`);
        }
        if (r.note) console.log(`   note: ${r.note}`);
      });
    } finally {
      // leave DB intact by request
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  });

  it('Health check — GET /health', async () => {
    const testName = 'Health check';
    try {
      const res = await request(app).get('/health');
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('status');
      results.push({ name: testName, status: 'passed', note: `status=${res.body.status}` });
    } catch (err) {
      console.error('TEST ERROR - Health check:', err);
      results.push({ name: testName, status: 'failed', error: err.message });
      expect.fail(err.message);
    }
  });

  it('Admin login and token issuance — POST /auth/login', async () => {
    const testName = 'Admin login + tokens';
    try {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('accessToken');
      expect(res.body).to.have.property('refreshToken');

      // 🔹 Update latest tokens so refresh test always uses the fresh DB one
      adminToken = res.body.accessToken;
      adminRefreshToken = res.body.refreshToken;

      results.push({ name: testName, status: 'passed' });
    } catch (err) {
      console.error('TEST ERROR - Admin login:', err);
      results.push({ name: testName, status: 'failed', error: err.message });
      expect.fail(err.message);
    }
  });

  it('Register viewer (admin) — POST /auth/register with admin token', async () => {
    const testName = 'Register viewer (admin)';
    try {
      const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Test Viewer',
          email: viewerEmail,
          password: viewerPassword,
          role: 'viewer',
          permissions: ['can_download'],
          addedBy: adminId
        });

      expect(res.status).to.equal(201);
      results.push({ name: testName, status: 'passed', note: `created ${viewerEmail}` });
    } catch (err) {
      console.error('TEST ERROR - Register viewer:', err);
      const body = err.response ? err.response.body : undefined;
      results.push({ name: testName, status: 'failed', error: err.message, body });
      expect.fail(err.message);
    }
  });

  it('Reject registration without token — POST /auth/register (no auth)', async () => {
    const testName = 'Reject register w/out token';
    try {
      const res = await request(app)
        .post('/auth/register')
        .send({
          fullName: 'Unauthorized User',
          email: `unauth_${Date.now()}@test.com`,
          password: 'Nope123!',
          role: 'viewer',
          permissions: [],
          addedBy: adminId
        });

      expect([401, 403]).to.include(res.status);
      results.push({ name: testName, status: 'passed', note: `status=${res.status}` });
    } catch (err) {
      console.error('TEST ERROR - Reject register w/out token:', err);
      results.push({ name: testName, status: 'failed', error: err.message });
      expect.fail(err.message);
    }
  });

  it('Refresh token — POST /auth/refresh', async () => {
    const testName = 'Refresh token';
    try {
      const res = await request(app).post('/auth/refresh').send({ token: adminRefreshToken });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('accessToken');
      results.push({ name: testName, status: 'passed' });
    } catch (err) {
      console.error('TEST ERROR - Refresh token:', err);
      const body = err.response ? err.response.body : undefined;
      results.push({ name: testName, status: 'failed', error: err.message, body });
      expect.fail(err.message);
    }
  });

  it('Viewer cannot call admin-only register — POST /auth/register (viewer token)', async () => {
    const testName = 'Viewer blocked from admin route';
    try {
      const logRes = await request(app).post('/auth/login').send({ email: viewerEmail, password: viewerPassword });
      expect(logRes.status).to.equal(200);
      const viewerToken = logRes.body.accessToken;

      const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          fullName: 'Another User',
          email: `another_${Date.now()}@test.com`,
          password: 'Another123!',
          role: 'viewer',
          permissions: []
        });

      expect(res.status).to.equal(403);
      results.push({ name: testName, status: 'passed' });
    } catch (err) {
      console.error('TEST ERROR - Viewer blocked from admin route:', err);
      const body = err.response ? err.response.body : undefined;
      results.push({ name: testName, status: 'failed', error: err.message, body });
      expect.fail(err.message);
    }
  });

  it('Logout (stateless) — POST /auth/logout', async () => {
    const testName = 'Logout stateless';
    try {
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      results.push({ name: testName, status: 'passed' });
    } catch (err) {
      console.error('TEST ERROR - Logout:', err);
      results.push({ name: testName, status: 'failed', error: err.message });
      expect.fail(err.message);
    }
  });
});
