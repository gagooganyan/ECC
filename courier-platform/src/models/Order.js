const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePrice(pickupLat, pickupLng, deliveryLat, deliveryLng) {
  const BASE = 50;
  const PER_KM = 20;
  if (pickupLat == null || deliveryLat == null) return BASE;
  const dist = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  return Math.round((BASE + PER_KM * dist) * 100) / 100;
}

function create(data) {
  const db = getDb();
  const id = uuidv4();
  const price = calculatePrice(
    data.pickup_lat, data.pickup_lng,
    data.delivery_lat, data.delivery_lng
  );
  db.prepare(`
    INSERT INTO orders
      (id, client_id, business_id, pickup_address, pickup_lat, pickup_lng,
       delivery_address, delivery_lat, delivery_lng, description, weight_kg,
       price, payment_method, scheduled_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, data.client_id, data.business_id || null,
    data.pickup_address, data.pickup_lat || null, data.pickup_lng || null,
    data.delivery_address, data.delivery_lat || null, data.delivery_lng || null,
    data.description, data.weight_kg || null,
    price, data.payment_method || 'cash', data.scheduled_at || null
  );
  return findById(id);
}

function findById(id) {
  return getDb().prepare(`
    SELECT o.*, u.name AS client_name, u.phone AS client_phone
    FROM orders o JOIN users u ON u.id = o.client_id
    WHERE o.id = ?
  `).get(id);
}

function listByClient(client_id) {
  return getDb().prepare(
    'SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC'
  ).all(client_id);
}

function listAvailable() {
  return getDb().prepare(
    "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at ASC"
  ).all();
}

function listByCourier(courier_id) {
  return getDb().prepare(
    'SELECT * FROM orders WHERE courier_id = ? ORDER BY created_at DESC'
  ).all(courier_id);
}

function accept(order_id, courier_id) {
  const db = getDb();
  const info = db.prepare(`
    UPDATE orders SET courier_id = ?, status = 'accepted', updated_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `).run(courier_id, order_id);
  return info.changes > 0;
}

function updateStatus(order_id, status, actor_courier_id = null) {
  const db = getDb();
  // couriers can only advance their own orders
  const cond = actor_courier_id
    ? 'AND courier_id = ?'
    : '';
  const params = actor_courier_id
    ? [status, order_id, actor_courier_id]
    : [status, order_id];
  const info = db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ? ${cond}`
  ).run(...params);
  return info.changes > 0;
}

function cancel(order_id, client_id) {
  const info = getDb().prepare(`
    UPDATE orders SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ? AND client_id = ? AND status = 'pending'
  `).run(order_id, client_id);
  return info.changes > 0;
}

function addRating(order_id, from_user, to_courier, score, comment) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO ratings (id, order_id, from_user, to_courier, score, comment) VALUES (?,?,?,?,?,?)'
  ).run(id, order_id, from_user, to_courier, score, comment || null);
}

module.exports = {
  create, findById, listByClient, listAvailable, listByCourier,
  accept, updateStatus, cancel, addRating, calculatePrice
};
