const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

let app, server, baseUrl;

before(async () => {
  // Require after env vars are set
  const mod = require('../src/server');
  app = mod.app;
  server = mod.server;
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

async function post(path, body) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
}

async function get(path, token) {
  const res = await fetch(baseUrl + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return { status: res.status, body: await res.json() };
}

describe('Auth', () => {
  let token;

  test('register new user', async () => {
    const r = await post('/auth/register', {
      name: 'Test User', email: 'test@example.com', password: 'password123'
    });
    assert.equal(r.status, 201);
    assert.ok(r.body.token);
    assert.equal(r.body.user.role, 'client');
    token = r.body.token;
  });

  test('duplicate email returns 409', async () => {
    const r = await post('/auth/register', {
      name: 'Another', email: 'test@example.com', password: 'password123'
    });
    assert.equal(r.status, 409);
  });

  test('login with correct credentials', async () => {
    const r = await post('/auth/login', { email: 'test@example.com', password: 'password123' });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
  });

  test('login with wrong password returns 401', async () => {
    const r = await post('/auth/login', { email: 'test@example.com', password: 'wrong' });
    assert.equal(r.status, 401);
  });

  test('/me returns user info', async () => {
    const r = await get('/auth/me', token);
    assert.equal(r.status, 200);
    assert.equal(r.body.email, 'test@example.com');
  });

  test('/me without token returns 401', async () => {
    const r = await get('/auth/me');
    assert.equal(r.status, 401);
  });
});
