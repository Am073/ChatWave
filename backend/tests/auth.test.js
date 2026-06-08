const test = require('node:test');
const assert = require('node:assert');
const { startTestServer, stopTestServer, TestClient } = require('./helper');

test.describe('Auth API Integration Tests', () => {
  test.before(async () => {
    await startTestServer();
  });

  test.after(async () => {
    await stopTestServer();
  });

  test('1. Register new user → expect 201 + cookies set', async () => {
    const client = new TestClient();
    
    // Fetch CSRF token first
    await client.get('/auth/csrf-token');
    
    const payload = {
      name: 'Test Student',
      college_id: 'STUDENT999',
      password: 'Password@123',
      college_name: 'Test College',
      department: 'Computer Science',
      role: 'student',
    };

    const res = await client.post('/auth/register', payload);

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.user);
    assert.strictEqual(res.data.user.college_id, 'STUDENT999');
    
    // Cookies should be saved in TestClient state
    assert.ok(client.cookies.includes('access_token'));
    assert.ok(client.cookies.includes('refresh_token'));
    assert.ok(client.cookies.includes('csrf_token'));
  });

  test('2. Login with wrong password → expect 401', async () => {
    const client = new TestClient();
    await client.get('/auth/csrf-token');

    const res = await client.post('/auth/login', {
      college_id: 'STUDENT999',
      password: 'WrongPassword',
      role: 'student',
    });

    assert.strictEqual(res.status, 401);
    assert.ok(res.data.error);
  });

  test('3. Login with correct password → expect 200 + HttpOnly cookie', async () => {
    const client = new TestClient();
    await client.get('/auth/csrf-token');

    const res = await client.post('/auth/login', {
      college_id: 'STUDENT999',
      password: 'Password@123',
      role: 'student',
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.user);
    assert.ok(client.cookies.includes('access_token'));
  });

  test('4. Access protected route without cookie → expect 401', async () => {
    const unauthenticatedClient = new TestClient();
    const res = await unauthenticatedClient.get('/auth/me');
    assert.strictEqual(res.status, 401);
  });

  test('5. Change password with correct old password → expect 200', async () => {
    const client = new TestClient();
    await client.get('/auth/csrf-token');

    // Login first
    await client.post('/auth/login', {
      college_id: 'STUDENT999',
      password: 'Password@123',
      role: 'student',
    });

    // Change password
    const res = await client.post('/auth/change-password', {
      oldPassword: 'Password@123',
      newPassword: 'NewPassword@123',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.message, 'Password changed successfully');

    // Check login with new password works
    const newLoginClient = new TestClient();
    await newLoginClient.get('/auth/csrf-token');
    const loginRes = await newLoginClient.post('/auth/login', {
      college_id: 'STUDENT999',
      password: 'NewPassword@123',
      role: 'student',
    });
    assert.strictEqual(loginRes.status, 200);
  });

  test('6. Change password with wrong old password → expect 400', async () => {
    const client = new TestClient();
    await client.get('/auth/csrf-token');

    // Login with new password
    await client.post('/auth/login', {
      college_id: 'STUDENT999',
      password: 'NewPassword@123',
      role: 'student',
    });

    // Try change password with wrong old password
    const res = await client.post('/auth/change-password', {
      oldPassword: 'IncorrectOldPassword',
      newPassword: 'Password@123',
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error);
  });
});
