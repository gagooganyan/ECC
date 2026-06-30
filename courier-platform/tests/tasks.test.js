const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-tasks';

let baseUrl, server;

before(async () => {
  const mod = require('../src/server');
  server = mod.server;
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

async function req(method, path, body, token) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json() };
}

async function register(name, email) {
  const r = await req('POST', '/auth/register', { name, email, password: 'pass1234' });
  return r.body.token;
}

const taskData = {
  category: 'construction',
  title: 'Помочь разгрузить кирпич',
  description: 'КамАЗ кирпича, нужно 2–3 человека на час',
  address: 'ул. Ленина 12, Кропоткин',
  price: 1500,
  price_type: 'fixed',
  duration_h: 3
};

describe('Tasks', () => {
  let clientToken, workerToken, taskId, workerId;

  before(async () => {
    clientToken = await register('Client', 'client-task@test.com');
    workerToken = await register('Worker', 'worker-task@test.com');

    const me = await req('GET', '/auth/me', null, workerToken);
    workerId = me.body.id;
  });

  test('client creates a task', async () => {
    const r = await req('POST', '/tasks', taskData, clientToken);
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'open');
    assert.equal(r.body.category, 'construction');
    assert.equal(r.body.price, 1500);
    taskId = r.body.id;
  });

  test('worker sees open tasks', async () => {
    const r = await req('GET', '/tasks/open', null, workerToken);
    assert.equal(r.status, 200);
    assert.ok(r.body.some(t => t.id === taskId));
  });

  test('worker responds to task', async () => {
    const r = await req('POST', `/tasks/${taskId}/respond`, {
      message: 'Готов помочь, есть опыт', price: 1400
    }, workerToken);
    assert.equal(r.status, 201);
    assert.ok(Array.isArray(r.body));
    assert.equal(r.body.length, 1);
    assert.equal(r.body[0].worker_name, 'Worker');
  });

  test('client sees responses', async () => {
    const r = await req('GET', `/tasks/${taskId}/responses`, null, clientToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 1);
  });

  test('client assigns worker', async () => {
    const r = await req('POST', `/tasks/${taskId}/assign/${workerId}`, null, clientToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'assigned');
    assert.equal(r.body.worker_id, workerId);
  });

  test('worker starts task', async () => {
    const r = await req('PUT', `/tasks/${taskId}/status`, { status: 'in_progress' }, workerToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'in_progress');
  });

  test('worker marks task done', async () => {
    const r = await req('PUT', `/tasks/${taskId}/status`, { status: 'done' }, workerToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'done');
  });

  test('client rates worker', async () => {
    const r = await req('POST', `/tasks/${taskId}/rate`, {
      score: 5, comment: 'Отличная работа!'
    }, clientToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
  });

  test('filter tasks by category', async () => {
    // create task in different category
    await req('POST', '/tasks', { ...taskData, category: 'cleaning', title: 'Уборка' }, clientToken);
    const r = await req('GET', '/tasks/open?category=cleaning', null, workerToken);
    assert.equal(r.status, 200);
    assert.ok(r.body.every(t => t.category === 'cleaning'));
  });

  test('worker sets skills', async () => {
    const r = await req('PUT', '/tasks/skills', {
      skills: ['construction', 'moving', 'garden']
    }, workerToken);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.skills, ['construction', 'moving', 'garden']);
  });
});
