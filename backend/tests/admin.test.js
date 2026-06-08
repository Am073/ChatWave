const test = require('node:test');
const assert = require('node:assert');
const { startTestServer, stopTestServer, TestClient } = require('./helper');

test.describe('Admin Protected Routes Tests', () => {
  let studentClient;
  let adminClient;

  test.before(async () => {
    await startTestServer();

    // Student Client
    studentClient = new TestClient();
    await studentClient.get('/auth/csrf-token');
    await studentClient.post('/auth/register', {
      name: 'Regular Student',
      college_id: 'STU_ADM_TEST',
      password: 'Password@123',
      college_name: 'Test College',
      department: 'Computer Science',
      role: 'student',
    });

    // Admin Client
    adminClient = new TestClient();
    await adminClient.get('/auth/csrf-token');
    await adminClient.post('/auth/register', {
      name: 'System Admin',
      college_id: 'ADM_ADM_TEST',
      password: 'Password@123',
      college_name: 'Test College',
      department: null,
      role: 'admin',
    });
  });

  test.after(async () => {
    await stopTestServer();
  });

  test('1. Student trying admin routes → expect 403', async () => {
    const res = await studentClient.get('/admin/stats');
    assert.strictEqual(res.status, 403);
    assert.ok(res.data.error.includes('Access forbidden'));
  });

  test('2. Admin GET /stats → expect valid stats object', async () => {
    const res = await adminClient.get('/admin/stats');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.hasOwnProperty('totalUsers'));
    assert.ok(res.data.hasOwnProperty('totalDocuments'));
    assert.ok(res.data.hasOwnProperty('totalChats'));
    assert.ok(res.data.hasOwnProperty('documentsProcessing'));
    assert.ok(res.data.hasOwnProperty('documentsFailed'));
    
    // Total users should count the registered users (at least student + admin)
    assert.ok(res.data.totalUsers >= 2);
  });
});
