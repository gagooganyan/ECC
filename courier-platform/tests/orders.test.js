const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-orders';

let baseUrl, server;

before(async () => {
  // Fresh require with clean module cache for this test file
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

const orderData = {
  pickup_address: 'Ул. Ленина 1',
  pickup_lat: 55.75, pickup_lng: 37.61,
  delivery_address: 'Ул. Пушкина 5',
  delivery_lat: 55.76, delivery_lng: 37.62,
  description: 'Пицца Маргарита',
  payment_method: 'cash'
};

describe('Orders', () => {
  let clientToken, courierToken, orderId;

  before(async () => {
    clientToken = await register('Client', 'client@test.com');
    courierToken = await register('Courier', 'courier@test.com');
    // Register as courier
    await req('POST', '/couriers/register', { vehicle_type: 'bike' }, courierToken);
    // Re-login to get updated role token
    const lr = await req('POST', '/auth/login', { email: 'courier@test.com', password: 'pass1234' });
    courierToken = lr.body.token;
  });

  test('client creates order', async () => {
    const r = await req('POST', '/orders', orderData, clientToken);
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'pending');
    assert.ok(r.body.price > 0);
    orderId = r.body.id;
  });

  test('courier sees available orders', async () => {
    const r = await req('GET', '/orders/available', null, courierToken);
    assert.equal(r.status, 200);
    assert.ok(r.body.some(o => o.id === orderId));
  });

  test('courier accepts order', async () => {
    const r = await req('POST', `/orders/${orderId}/accept`, null, courierToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'accepted');
  });

  test('order no longer available after acceptance', async () => {
    const r = await req('GET', '/orders/available', null, courierToken);
    assert.ok(!r.body.some(o => o.id === orderId));
  });

  test('courier marks as picked_up', async () => {
    const r = await req('PUT', `/orders/${orderId}/status`, { status: 'picked_up' }, courierToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'picked_up');
  });

  test('courier marks as delivered', async () => {
    const r = await req('PUT', `/orders/${orderId}/status`, { status: 'delivered' }, courierToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'delivered');
  });

  test('client can rate after delivery', async () => {
    const r = await req('POST', `/orders/${orderId}/rate`, { score: 5, comment: 'Отлично!' }, clientToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
  });

  test('client cannot cancel delivered order', async () => {
    const r = await req('DELETE', `/orders/${orderId}`, null, clientToken);
    assert.equal(r.status, 409);
  });

  test('price calculated correctly (haversine)', async () => {
    const r = await req('POST', '/orders', {
      ...orderData,
      pickup_lat: 0, pickup_lng: 0, delivery_lat: 0, delivery_lng: 0
    }, clientToken);
    assert.equal(r.status, 201);
    assert.equal(r.body.price, 50); // zero distance = base fee only
  });
});
